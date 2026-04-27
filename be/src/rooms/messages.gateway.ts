import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RoomsService } from './rooms.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10 * 1024 * 1024,
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private usersInCall: Map<string, string> = new Map(); // userId -> roomId
  private activeCalls: Map<string, string> = new Map(); // roomId -> callerId

  constructor(
    private messagesService: MessagesService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private roomsService: RoomsService,
    private jwtService: JwtService,
  ) {}

  private async broadcastUserStatus(
    userId: string,
    status: string,
    last_seen?: Date,
  ) {
    try {
      const roomIds = await this.roomsService.getUserRoomIds(userId);
      roomIds.forEach((roomId) => {
        this.server
          .to(`room-${roomId}`)
          .emit('user-status-changed', { userId, status, last_seen });
      });
      const ownSockets = this.getSocketIdsByUserId(userId);
      ownSockets.forEach((sid) =>
        this.server
          .to(sid)
          .emit('user-status-changed', { userId, status, last_seen }),
      );
    } catch (err) {
      console.error('Failed to broadcast user status', err);
    }
  }

  private getSocketIdsByUserId(userId: string): string[] {
    const socketIds: string[] = [];
    for (const [socketId, mappedUserId] of this.userSockets.entries()) {
      if (mappedUserId === userId) {
        socketIds.push(socketId);
      }
    }
    return socketIds;
  }

  notifyUserRemovedFromRoom(
    roomId: string,
    userId: string,
    reason: 'kicked' | 'left' = 'kicked',
    newOwner?: any,
  ) {
    const roomChannel = `room-${roomId}`;
    const socketIds = this.getSocketIdsByUserId(userId);

    socketIds.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.leave(roomChannel);
      socket.emit('room-removed', { roomId, reason });
    });

    // Notify other members
    this.server
      .to(roomChannel)
      .emit('room-member-removed', { roomId, userId, newOwner });
  }

  notifyUserAddedToRoom(userId: string, room: any) {
    const socketIds = this.getSocketIdsByUserId(userId);
    const roomChannel = `room-${room.id}`;

    socketIds.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) return;

      socket.join(roomChannel);
      socket.emit('room-added', { room });
    });

    // Notify other members
    this.server.to(roomChannel).emit('room-member-added', {
      roomId: room.id,
      user: room.members?.find((m) => String(m.id) === String(userId)) || {
        id: userId,
      },
    });
  }

  notifyFriendRemoved(userId: string, friendId: string) {
    const socketIds = this.getSocketIdsByUserId(userId);

    socketIds.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.emit('friend-removed', { friendId });
    });
  }

  notifyFriendRequestAccepted(
    userId: string,
    payload: {
      requestId: string;
      friend: {
        id: string;
        username?: string;
        email?: string;
        avatar_url?: string;
        status?: string;
      };
    },
  ) {
    const socketIds = this.getSocketIdsByUserId(userId);

    socketIds.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.emit('friend-request-accepted', payload);
    });
  }

  notifyFriendRequestReceived(
    userId: string,
    payload: {
      requestId: string;
      sender: {
        id: string;
        username?: string;
        email?: string;
        avatar_url?: string;
        status?: string;
      };
      created_at?: Date;
    },
  ) {
    const socketIds = this.getSocketIdsByUserId(userId);

    socketIds.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.emit('friend-request-received', payload);
    });
  }

  notifyUserBlocked(blockedId: string, blockerId: string) {
    const socketIds = this.getSocketIdsByUserId(blockedId);
    socketIds.forEach((sid) => {
      this.server.to(sid).emit('user-blocked', { blockerId });
    });
  }

  notifyUserUnblocked(blockedId: string, blockerId: string) {
    const socketIds = this.getSocketIdsByUserId(blockedId);
    socketIds.forEach((sid) => {
      this.server.to(sid).emit('user-unblocked', { blockerId });
    });
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        console.log('[SOCKET] ❌ No token');
        client.emit('error', { message: 'Not authenticated' });
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub || decoded.id;

      const socketIds = this.getSocketIdsByUserId(userId);
      this.userSockets.set(client.id, userId);

      if (socketIds.length === 0) {
        const userObj = await this.usersService.updateUserStatus(
          userId,
          'online',
        );
        this.broadcastUserStatus(userId, 'online', userObj.last_seen);
      }

      console.log('[SOCKET] ✅ Connected:', userId);
    } catch (error: any) {
      console.log('[SOCKET] ❌ Verify error:', error.message);
      client.emit('error', { message: 'Not authenticated' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.userSockets.get(client.id);

    if (userId) {
      this.userSockets.delete(client.id);

      const remainingSockets = this.getSocketIdsByUserId(userId);
      if (remainingSockets.length === 0) {
        const userObj = await this.usersService.updateUserStatus(
          userId,
          'offline',
        );
        this.broadcastUserStatus(userId, 'offline', userObj.last_seen);
      }

      // Cleanup busy status
      if (this.usersInCall.has(userId)) {
        this.usersInCall.delete(userId);
      }

      console.log('[SOCKET] ❌ Disconnected:', userId);
    }

    if (this.typingTimeouts.has(client.id)) {
      clearTimeout(this.typingTimeouts.get(client.id));
      this.typingTimeouts.delete(client.id);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    // Keep authenticated user id from handleConnection; only fallback to payload if needed
    const userId = this.userSockets.get(client.id) || data.userId;
    if (!userId) return;

    const isMember = await this.messagesService.isRoomMember(
      data.roomId,
      userId,
    );
    if (!isMember) {
      client.emit('room-removed', { roomId: data.roomId, reason: 'kicked' });
      client.leave(`room-${data.roomId}`);
      return;
    }

    client.join(`room-${data.roomId}`);
    this.userSockets.set(client.id, userId);

    // AUTO-SYNC: Mark as delivered for this user upon joining
    try {
      const updatedMessages = await this.messagesService.markRoomAsDelivered(
        data.roomId,
        userId,
      );
      if (updatedMessages.length > 0) {
        updatedMessages.forEach((msg) => {
          this.server.to(`room-${data.roomId}`).emit('message-updated', msg);
        });
      }
    } catch (error) {
      console.error('Auto-delivery sync failed:', error);
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      content: string;
      replyToMessageId?: string;
      type?: any;
      mentions?: string[];
    },
  ) {
    const userId = this.userSockets.get(client.id);

    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const isMember = await this.messagesService.isRoomMember(
        data.roomId,
        userId,
      );
      if (!isMember) {
        client.emit('room-removed', { roomId: data.roomId, reason: 'kicked' });
        client.leave(`room-${data.roomId}`);
        client.emit('error', {
          message: 'You are no longer a member of this room',
        });
        return;
      }

      const message = await this.messagesService.sendMessage(
        data.roomId,
        userId,
        data.content,
        data.replyToMessageId,
        data.type,
        data.mentions,
      );

      this.server.to(`room-${data.roomId}`).emit('new-message', message);
      console.log('[SOCKET] 📨 Message:', {
        userId,
        room: data.roomId,
        content: data.content.slice(0, 30),
      });
    } catch (error: any) {
      console.error('[SOCKET] ❌ Error:', error);
      client.emit('error', {
        message: error?.message || 'Failed to send message',
      });
    }
  }

  @SubscribeMessage('forward-message')
  async handleForwardMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: string;
      targetRoomId: string;
    },
  ) {
    const userId = this.userSockets.get(client.id);

    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const message = await this.messagesService.forwardMessage(
        data.messageId,
        data.targetRoomId,
        userId,
      );

      this.server.to(`room-${data.targetRoomId}`).emit('new-message', message);
    } catch (error: any) {
      console.error('[SOCKET] ❌ Forward Error:', error);
      client.emit('error', {
        message: error?.message || 'Failed to forward message',
      });
    }
  }

  @SubscribeMessage('message-delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = this.userSockets.get(client.id);
    if (!userId) return;

    try {
      const updatedMessage = await this.messagesService.markMessageAsDelivered(
        data.messageId,
      );
      if (updatedMessage) {
        this.server
          .to(`room-${updatedMessage.room.id}`)
          .emit('message-updated', updatedMessage);
      }
    } catch (error) {
      console.error('Delivery tracking failed:', error);
    }
  }

  @SubscribeMessage('mark-room-delivered')
  async handleMarkRoomDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = this.userSockets.get(client.id);
    if (!userId) return;

    try {
      const updatedMessages = await this.messagesService.markRoomAsDelivered(
        data.roomId,
        userId,
      );
      if (updatedMessages.length > 0) {
        updatedMessages.forEach((msg) => {
          this.server.to(`room-${data.roomId}`).emit('message-updated', msg);
        });
      }
    } catch (error) {
      console.error('Room delivery tracking failed:', error);
    }
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(`room-${data.roomId}`);
  }

  // NEW: Typing indicator
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username: string },
  ) {
    // Broadcast typing status
    this.server.to(`room-${data.roomId}`).emit('user-typing', {
      userId: data.userId,
      username: data.username,
    });

    // Clear previous timeout
    if (this.typingTimeouts.has(client.id)) {
      clearTimeout(this.typingTimeouts.get(client.id));
    }

    // Set timeout to auto-remove typing status
    const timeout = setTimeout(() => {
      this.server.to(`room-${data.roomId}`).emit('user-stopped-typing', {
        userId: data.userId,
      });
      this.typingTimeouts.delete(client.id);
    }, 3000);

    this.typingTimeouts.set(client.id, timeout);
  }

  @SubscribeMessage('stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    // Clear timeout
    if (this.typingTimeouts.has(client.id)) {
      clearTimeout(this.typingTimeouts.get(client.id));
      this.typingTimeouts.delete(client.id);
    }

    this.server.to(`room-${data.roomId}`).emit('user-stopped-typing', {
      userId: data.userId,
    });
  }

  @SubscribeMessage('audio-call-offer')
  async handleAudioCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; offer: any; callType?: string },
  ) {
    const fromUserId = this.userSockets.get(client.id);
    if (!fromUserId) {
      console.log('[CALL] ❌ Offer failed: No fromUserId');
      return;
    }

    console.log(`[CALL] 📞 Offer from ${fromUserId} in room ${data.roomId}`);

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      const sender = members.find((m) => m.id === fromUserId);
      const fromUsername = sender?.username || 'Nguoi dung';
      console.log(`[CALL] 👥 Room members found: ${members.length}`);

      members.forEach((member) => {
        if (member.id === fromUserId) return;
        const targetSocketIds = this.getSocketIdsByUserId(member.id);
        console.log(
          `[CALL] 📤 Relaying to user ${member.id} (${targetSocketIds.length} sockets)`,
        );

        targetSocketIds.forEach((sid) => {
          this.server.to(sid).emit('audio-call-offer', {
            roomId: data.roomId,
            offer: data.offer,
            fromUserId,
            fromUsername,
            callType: data.callType || 'audio',
          });
        });
      });
    } catch (error) {
      console.error('[CALL] ❌ Relay failed:', error);
    }
  }

  @SubscribeMessage('audio-call-answer')
  async handleAudioCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; answer: any },
  ) {
    const fromUserId = this.userSockets.get(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) => {
        if (member.id === fromUserId) return;
        const targetSocketIds = this.getSocketIdsByUserId(member.id);
        targetSocketIds.forEach((sid) => {
          this.server.to(sid).emit('audio-call-answer', {
            roomId: data.roomId,
            answer: data.answer,
            fromUserId,
          });
        });
      });
    } catch (error) {
      console.error('Call answer relay failed:', error);
    }
  }

  @SubscribeMessage('audio-call-ice-candidate')
  async handleAudioCallIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; candidate: any },
  ) {
    const fromUserId = this.userSockets.get(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) => {
        if (member.id === fromUserId) return;
        const targetSocketIds = this.getSocketIdsByUserId(member.id);
        targetSocketIds.forEach((sid) => {
          this.server.to(sid).emit('audio-call-ice-candidate', {
            roomId: data.roomId,
            candidate: data.candidate,
            fromUserId,
          });
        });
      });
    } catch (error) {
      console.error('ICE candidate relay failed:', error);
    }
  }

  @SubscribeMessage('audio-call-end')
  async handleAudioCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; duration?: number; callType?: string },
  ) {
    const fromUserId = this.userSockets.get(client.id);
    if (!fromUserId) return;

    try {
      // Save call log message
      const duration = data.duration || 0;
      const callerId = this.activeCalls.get(data.roomId) || fromUserId;

      const callLogMessage = await this.messagesService.sendMessage(
        data.roomId,
        callerId,
        `CALL_LOG:${data.callType || 'audio'}:${duration}`,
        undefined,
        'call',
      );
      this.activeCalls.delete(data.roomId);

      // Broadcast call end to other members
      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) => {
        if (member.id === fromUserId) return;
        const targetSocketIds = this.getSocketIdsByUserId(member.id);
        targetSocketIds.forEach((sid) => {
          this.server.to(sid).emit('audio-call-end', {
            roomId: data.roomId,
            fromUserId,
          });
        });
      });

      // Broadcast the new call log message to everyone in the room
      this.server.to(`room-${data.roomId}`).emit('new-message', callLogMessage);

      // Cleanup usersInCall for this room
      for (const [uid, rid] of this.usersInCall.entries()) {
        if (rid === data.roomId) {
          this.usersInCall.delete(uid);
        }
      }
      this.activeCalls.delete(data.roomId);
    } catch (error) {
      console.error('Call end handling failed:', error);
    }
  }

  @SubscribeMessage('audio-call-request')
  async handleAudioCallRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; callType?: string },
  ) {
    const fromUserId = this.userSockets.get(client.id);
    if (!fromUserId) return;

    try {
      const isGroup = await this.messagesService.isRoomGroupChat(data.roomId);
      const members = await this.messagesService.getRoomMembers(data.roomId);
      const sender = members.find((m) => m.id === fromUserId);
      const fromUsername = sender?.username || 'Nguoi dung';

      if (!isGroup) {
        const otherMember = members.find((m) => m.id !== fromUserId);
        if (otherMember) {
          const isBlocked = await this.usersService.isAnyBlocked(
            fromUserId,
            otherMember.id,
          );
          if (isBlocked) {
            console.log(
              `[CALL] 🚫 Blocked: ${fromUserId} or ${otherMember.id} has blocked the other.`,
            );
            client.emit('error', {
              message: 'Bạn không thể gọi cho người dùng này.',
            });
            return;
          }
        }
      }

      this.activeCalls.set(data.roomId, fromUserId);

      // Check if target is busy (DISABLED)
      /*
      const busyMember = members.find(
        (m) => m.id !== fromUserId && this.usersInCall.has(m.id),
      );
      if (busyMember) {
        console.log(
          `[CALL] 🚫 Busy: ${busyMember.id} is already in call ${this.usersInCall.get(busyMember.id)}`,
        );
        client.emit('audio-call-busy', {
          roomId: data.roomId,
          busyUserId: busyMember.id,
        });
        return;
      }

      // Mark all participants as busy
      members.forEach((m) => this.usersInCall.set(m.id, data.roomId));
      */

      members.forEach((member) => {
        if (member.id === fromUserId) return;
        const targetSocketIds = this.getSocketIdsByUserId(member.id);
        targetSocketIds.forEach((sid) => {
          this.server.to(sid).emit('audio-call-request', {
            roomId: data.roomId,
            fromUserId,
            fromUsername,
            callType: data.callType || 'audio',
          });
        });
      });
    } catch (error) {
      console.error('Call request relay failed:', error);
    }
  }

  @SubscribeMessage('audio-call-ready')
  async handleAudioCallReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const fromUserId = this.userSockets.get(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);

      // Mark participants as in call
      members.forEach((member) => {
        this.usersInCall.set(member.id, data.roomId);
      });

      members.forEach((member) => {
        if (member.id === fromUserId) return;
        const targetSocketIds = this.getSocketIdsByUserId(member.id);
        targetSocketIds.forEach((sid) => {
          this.server.to(sid).emit('audio-call-ready', {
            roomId: data.roomId,
            fromUserId,
          });
        });
      });
    } catch (error) {
      console.error('Call ready relay failed:', error);
    }
  }
}
