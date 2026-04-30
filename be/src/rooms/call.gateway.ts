import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { UsersService } from '../users/users.service';
import {
  UseGuards,
  UsePipes,
  ValidationPipe,
  Injectable,
} from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { SocketStateService } from './socket-state.service';

@Injectable()
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe())
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class CallGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private messagesService: MessagesService,
    private usersService: UsersService,
    private socketState: SocketStateService,
  ) {}

  @SubscribeMessage('audio-call-offer')
  async handleAudioCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; offer: any; callType?: string },
  ) {
    const fromUserId = this.socketState.getUserId(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      const sender = members.find((m) => m.id === fromUserId);
      const fromUsername = sender?.username || 'Nguoi dung';

      members.forEach((member) => {
        if (member.id === fromUserId) return;
        this.emitToUser(member.id, 'audio-call-offer', {
          roomId: data.roomId,
          offer: data.offer,
          fromUserId,
          fromUsername,
          callType: data.callType || 'audio',
        });
      });
    } catch (error) {
      console.error('Call offer relay failed:', error);
    }
  }

  @SubscribeMessage('audio-call-answer')
  async handleAudioCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; answer: any },
  ) {
    const fromUserId = this.socketState.getUserId(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) => {
        if (member.id === fromUserId) return;
        this.emitToUser(member.id, 'audio-call-answer', {
          roomId: data.roomId,
          answer: data.answer,
          fromUserId,
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
    const fromUserId = this.socketState.getUserId(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) => {
        if (member.id === fromUserId) return;
        this.emitToUser(member.id, 'audio-call-ice-candidate', {
          roomId: data.roomId,
          candidate: data.candidate,
          fromUserId,
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
    const fromUserId = this.socketState.getUserId(client.id);
    if (!fromUserId) return;

    try {
      const duration = data.duration || 0;
      const callerId =
        this.socketState.activeCalls.get(data.roomId) || fromUserId;

      const callLogMessage = await this.messagesService.sendMessage(
        data.roomId,
        callerId,
        `CALL_LOG:${data.callType || 'audio'}:${duration}`,
        undefined,
        'call',
      );
      this.socketState.activeCalls.delete(data.roomId);

      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) => {
        if (member.id === fromUserId) return;
        this.emitToUser(member.id, 'audio-call-end', {
          roomId: data.roomId,
          fromUserId,
        });
      });

      this.server.to(`room-${data.roomId}`).emit('new-message', callLogMessage);

      for (const [uid, rid] of this.socketState.usersInCall.entries()) {
        if (rid === data.roomId) this.socketState.usersInCall.delete(uid);
      }
    } catch (error) {
      console.error('Call end handling failed:', error);
    }
  }

  @SubscribeMessage('audio-call-request')
  async handleAudioCallRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; callType?: string },
  ) {
    const fromUserId = this.socketState.getUserId(client.id);
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
            client.emit('error', {
              message: 'Bạn không thể gọi cho người dùng này.',
            });
            return;
          }
        }
      }

      this.socketState.activeCalls.set(data.roomId, fromUserId);

      members.forEach((member) => {
        if (member.id === fromUserId) return;
        this.emitToUser(member.id, 'audio-call-request', {
          roomId: data.roomId,
          fromUserId,
          fromUsername,
          callType: data.callType || 'audio',
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
    const fromUserId = this.socketState.getUserId(client.id);
    if (!fromUserId) return;

    try {
      const members = await this.messagesService.getRoomMembers(data.roomId);
      members.forEach((member) =>
        this.socketState.usersInCall.set(member.id, data.roomId),
      );

      members.forEach((member) => {
        if (member.id === fromUserId) return;
        this.emitToUser(member.id, 'audio-call-ready', {
          roomId: data.roomId,
          fromUserId,
        });
      });
    } catch (error) {
      console.error('Call ready relay failed:', error);
    }
  }

  private emitToUser(userId: string, event: string, data: any) {
    const socketIds = this.socketState.getSocketIdsByUserId(userId);
    socketIds.forEach((sid) => this.server.to(sid).emit(event, data));
  }
}
