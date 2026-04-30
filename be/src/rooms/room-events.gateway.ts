import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Injectable,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { SocketStateService } from './socket-state.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

@Injectable()
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe())
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class RoomEventsGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private roomsService: RoomsService,
    private socketState: SocketStateService,
  ) {}

  @OnEvent('room.created')
  async handleRoomCreated(payload: {
    room: any;
    ownerId: string;
    invitedMemberIds: string[];
  }) {
    const { room, invitedMemberIds } = payload;
    await Promise.all(
      invitedMemberIds.map(async (memberId) => {
        const roomSummary = await this.roomsService.getRoomSummaryForUser(
          room.id,
          memberId,
        );
        if (roomSummary) {
          this.notifyUserAddedToRoom(memberId, roomSummary);
        }
      }),
    );
  }

  @OnEvent('room.member.added')
  async handleMemberAdded(payload: { roomId: string; userId: string }) {
    const roomSummary = await this.roomsService.getRoomSummaryForUser(
      payload.roomId,
      payload.userId,
    );
    if (roomSummary) {
      this.notifyUserAddedToRoom(payload.userId, roomSummary);
    }
  }

  @OnEvent('room.member.removed')
  handleMemberRemoved(payload: {
    roomId: string;
    userId: string;
    reason: 'kicked' | 'left';
    newOwner: any;
  }) {
    this.notifyUserRemovedFromRoom(
      payload.roomId,
      payload.userId,
      payload.reason,
      payload.newOwner,
    );
  }

  @OnEvent('friend.removed')
  handleFriendRemoved(payload: { userId: string; targetUserId: string }) {
    this.emitToUser(payload.targetUserId, 'friend-removed', {
      userId: payload.userId,
    });
    this.emitToUser(payload.userId, 'friend-removed', {
      friendId: payload.targetUserId,
    });
  }

  @OnEvent('friend.request.accepted')
  handleFriendRequestAccepted(eventPayload: {
    targetId: string;
    payload: any;
  }) {
    this.emitToUser(
      eventPayload.targetId,
      'friend-request-accepted',
      eventPayload.payload,
    );
  }

  @OnEvent('friend.request.received')
  handleFriendRequestReceived(eventPayload: { receiverId: string; data: any }) {
    this.emitToUser(
      eventPayload.receiverId,
      'friend-request-received',
      eventPayload.data,
    );
  }

  @OnEvent('user.blocked')
  handleUserBlocked(payload: { blockedId: string; blockerId: string }) {
    this.emitToUser(payload.blockedId, 'user-blocked', {
      blockerId: payload.blockerId,
    });
  }

  @OnEvent('user.unblocked')
  handleUserUnblocked(payload: { blockedId: string; blockerId: string }) {
    this.emitToUser(payload.blockedId, 'user-unblocked', {
      blockerId: payload.blockerId,
    });
  }

  @OnEvent('room.history.cleared')
  handleHistoryCleared(payload: { roomId: string; userId: string }) {
    this.emitToUser(payload.userId, 'history-cleared', {
      roomId: payload.roomId,
    });
  }

  @OnEvent('message.sent')
  handleMessageSent(payload: { roomId: string; message: any }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('new-message', payload.message);
  }

  @OnEvent('message.updated')
  handleMessageUpdated(payload: { roomId: string; message: any }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('message-updated', payload.message);
  }

  @OnEvent('message.reaction_updated')
  handleReactionUpdated(payload: { roomId: string; message: any }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('reaction-updated', payload.message);
  }

  @OnEvent('message.seen')
  handleMessageSeen(payload: {
    roomId: string;
    user: any;
    updatedMessages: any[];
  }) {
    this.server.to(`room-${payload.roomId}`).emit('messages-seen', payload);
  }

  @OnEvent('message.room_delivered')
  handleRoomDelivered(payload: { roomId: string; messages: any[] }) {
    payload.messages.forEach((msg) => {
      this.server.to(`room-${payload.roomId}`).emit('message-updated', msg);
    });
  }

  private notifyUserAddedToRoom(userId: string, room: any) {
    const socketIds = this.socketState.getSocketIdsByUserId(userId);
    const roomChannel = `room-${room.id}`;
    socketIds.forEach((sid) => {
      const socket = this.server.sockets.sockets.get(sid);
      if (socket) {
        socket.join(roomChannel);
        socket.emit('room-added', { room });
      }
    });
    this.server.to(roomChannel).emit('room-member-added', {
      roomId: room.id,
      user: room.members?.find((m) => String(m.id) === String(userId)) || {
        id: userId,
      },
    });
  }

  private notifyUserRemovedFromRoom(
    roomId: string,
    userId: string,
    reason: string,
    newOwner?: any,
  ) {
    const roomChannel = `room-${roomId}`;
    const socketIds = this.socketState.getSocketIdsByUserId(userId);
    socketIds.forEach((sid) => {
      const socket = this.server.sockets.sockets.get(sid);
      if (socket) {
        socket.leave(roomChannel);
        socket.emit('room-removed', { roomId, reason });
      }
    });
    this.server
      .to(roomChannel)
      .emit('room-member-removed', { roomId, userId, newOwner });
  }

  private emitToUser(userId: string, event: string, data: any) {
    const socketIds = this.socketState.getSocketIdsByUserId(userId);
    socketIds.forEach((sid) => {
      this.server.to(sid).emit(event, data);
    });
  }
}
