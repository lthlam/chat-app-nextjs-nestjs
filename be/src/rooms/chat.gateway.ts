import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import {
  UseGuards,
  UsePipes,
  ValidationPipe,
  Injectable,
} from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { JoinRoomDto, SendMessageDto } from './dto/rooms.dto';
import { SocketStateService } from './socket-state.service';

@Injectable()
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe())
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private messagesService: MessagesService,
    private socketState: SocketStateService,
  ) {}

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    const userId = this.socketState.getUserId(client.id) || data.userId;
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

    try {
      const updatedMessages = await this.messagesService.markRoomAsDelivered(
        data.roomId,
        userId,
      );
      updatedMessages.forEach((msg) => {
        this.server.to(`room-${data.roomId}`).emit('message-updated', msg);
      });
    } catch (error) {
      console.error('Auto-delivery sync failed:', error);
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const userId = this.socketState.getUserId(client.id);
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
    } catch (error: any) {
      client.emit('error', {
        message: error?.message || 'Failed to send message',
      });
    }
  }

  @SubscribeMessage('forward-message')
  async handleForwardMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; targetRoomId: string },
  ) {
    const userId = this.socketState.getUserId(client.id);
    if (!userId) return;

    try {
      const message = await this.messagesService.forwardMessage(
        data.messageId,
        data.targetRoomId,
        userId,
      );
      this.server.to(`room-${data.targetRoomId}`).emit('new-message', message);
    } catch (error: any) {
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

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username: string },
  ) {
    this.server
      .to(`room-${data.roomId}`)
      .emit('user-typing', { userId: data.userId, username: data.username });

    if (this.socketState.typingTimeouts.has(client.id)) {
      clearTimeout(this.socketState.typingTimeouts.get(client.id));
    }

    const timeout = setTimeout(() => {
      this.server
        .to(`room-${data.roomId}`)
        .emit('user-stopped-typing', { userId: data.userId });
      this.socketState.typingTimeouts.delete(client.id);
    }, 3000);

    this.socketState.typingTimeouts.set(client.id, timeout);
  }

  @SubscribeMessage('stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    if (this.socketState.typingTimeouts.has(client.id)) {
      clearTimeout(this.socketState.typingTimeouts.get(client.id));
      this.socketState.typingTimeouts.delete(client.id);
    }
    this.server
      .to(`room-${data.roomId}`)
      .emit('user-stopped-typing', { userId: data.userId });
  }
}
