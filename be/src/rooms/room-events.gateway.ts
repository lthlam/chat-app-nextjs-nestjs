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
import { ROOM_EVENTS } from './constants/room-events.constants';
import { FRIEND_EVENTS } from '../friends/constants/friend-events.constants';

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

  @OnEvent(ROOM_EVENTS.ROOM_CREATED)
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

  @OnEvent(ROOM_EVENTS.MEMBER_ADDED)
  async handleMemberAdded(payload: { roomId: string; userId: string }) {
    const roomSummary = await this.roomsService.getRoomSummaryForUser(
      payload.roomId,
      payload.userId,
    );
    if (roomSummary) {
      this.notifyUserAddedToRoom(payload.userId, roomSummary);
    }
  }

  @OnEvent(ROOM_EVENTS.MEMBER_REMOVED)
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

  @OnEvent(FRIEND_EVENTS.REMOVED)
  handleFriendRemoved(payload: { userId: string; targetUserId: string }) {
    this.emitToUser(payload.targetUserId, 'friend-removed', {
      userId: payload.userId,
    });
    this.emitToUser(payload.userId, 'friend-removed', {
      friendId: payload.targetUserId,
    });
  }

  @OnEvent(FRIEND_EVENTS.REQUEST_ACCEPTED)
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

  @OnEvent(FRIEND_EVENTS.REQUEST_RECEIVED)
  handleFriendRequestReceived(eventPayload: { receiverId: string; data: any }) {
    this.emitToUser(
      eventPayload.receiverId,
      'friend-request-received',
      eventPayload.data,
    );
  }

  @OnEvent(FRIEND_EVENTS.USER_BLOCKED)
  handleUserBlocked(payload: { blockedId: string; blockerId: string }) {
    this.emitToUser(payload.blockedId, 'user-blocked', {
      blockerId: payload.blockerId,
    });
  }

  @OnEvent(FRIEND_EVENTS.USER_UNBLOCKED)
  handleUserUnblocked(payload: { blockedId: string; blockerId: string }) {
    this.emitToUser(payload.blockedId, 'user-unblocked', {
      blockerId: payload.blockerId,
    });
  }

  @OnEvent(ROOM_EVENTS.HISTORY_CLEARED)
  handleHistoryCleared(payload: { roomId: string; userId: string }) {
    this.emitToUser(payload.userId, 'history-cleared', {
      roomId: payload.roomId,
    });
  }

  @OnEvent(ROOM_EVENTS.MESSAGE_SENT)
  handleMessageSent(payload: { roomId: string; message: any }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('new-message', payload.message);
  }

  @OnEvent(ROOM_EVENTS.MESSAGE_UPDATED)
  handleMessageUpdated(payload: { roomId: string; message: any }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('message-updated', payload.message);
  }

  @OnEvent(ROOM_EVENTS.MESSAGE_REACTION_UPDATED)
  handleReactionUpdated(payload: { roomId: string; message: any }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('reaction-updated', payload.message);
  }

  @OnEvent(ROOM_EVENTS.MESSAGE_SEEN)
  handleMessageSeen(payload: {
    roomId: string;
    user: any;
    updatedMessages: any[];
  }) {
    this.server.to(`room-${payload.roomId}`).emit('messages-seen', payload);
  }

  @OnEvent(ROOM_EVENTS.MESSAGE_ROOM_DELIVERED)
  handleRoomDelivered(payload: { roomId: string; messages: any[] }) {
    payload.messages.forEach((msg) => {
      this.server.to(`room-${payload.roomId}`).emit('message-updated', msg);
    });
  }

  @OnEvent(ROOM_EVENTS.TYPING_STARTED)
  handleTypingStarted(payload: {
    roomId: string;
    userId: string;
    username: string;
  }) {
    this.server.to(`room-${payload.roomId}`).emit('user-typing', {
      userId: payload.userId,
      username: payload.username,
    });
  }

  @OnEvent(ROOM_EVENTS.TYPING_STOPPED)
  handleTypingStopped(payload: { roomId: string; userId: string }) {
    this.server
      .to(`room-${payload.roomId}`)
      .emit('user-stopped-typing', { userId: payload.userId });
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
