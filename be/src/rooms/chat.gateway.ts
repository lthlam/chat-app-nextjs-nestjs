import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { MessagesSearchService } from './services/messages-search.service';
import { MessagesReactionService } from './services/messages-reaction.service';
import {
  UseGuards,
  UsePipes,
  ValidationPipe,
  Injectable,
} from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { JoinRoomDto, SendMessageDto } from './dto/rooms.dto';
import { SocketStateService } from './socket-state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private searchService: MessagesSearchService,
    private reactionService: MessagesReactionService,
    private socketState: SocketStateService,
    private eventEmitter: EventEmitter2,
  ) {}

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    const userId = this.socketState.getUserId(client.id) || data.userId;
    if (!userId) return;

    const isMember = await this.searchService.isRoomMember(data.roomId, userId);
    if (!isMember) {
      client.emit('room-removed', { roomId: data.roomId, reason: 'kicked' });
      client.leave(`room-${data.roomId}`);
      return;
    }

    client.join(`room-${data.roomId}`);

    try {
      await this.reactionService.markRoomAsDelivered(data.roomId, userId);
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
      const isMember = await this.searchService.isRoomMember(
        data.roomId,
        userId,
      );
      if (!isMember) {
        client.emit('room-removed', { roomId: data.roomId, reason: 'kicked' });
        client.leave(`room-${data.roomId}`);
        return;
      }

      await this.messagesService.sendMessage(
        data.roomId,
        userId,
        data.content,
        data.replyToMessageId,
        data.type,
        data.mentions,
      );
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
      await this.messagesService.forwardMessage(
        data.messageId,
        data.targetRoomId,
        userId,
      );
    } catch (error: any) {
      client.emit('error', {
        message: error?.message || 'Failed to forward message',
      });
    }
  }

  @SubscribeMessage('message-delivered')
  async handleMessageDelivered(@MessageBody() data: { messageId: string }) {
    try {
      await this.reactionService.markMessageAsDelivered(data.messageId);
    } catch (error) {
      console.error('Delivery tracking failed:', error);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username: string },
  ) {
    this.eventEmitter.emit('typing.started', {
      roomId: data.roomId,
      userId: data.userId,
      username: data.username,
    });

    if (this.socketState.typingTimeouts.has(client.id)) {
      clearTimeout(this.socketState.typingTimeouts.get(client.id));
    }

    const timeout = setTimeout(() => {
      this.eventEmitter.emit('typing.stopped', {
        roomId: data.roomId,
        userId: data.userId,
      });
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
    this.eventEmitter.emit('typing.stopped', {
      roomId: data.roomId,
      userId: data.userId,
    });
  }
}
