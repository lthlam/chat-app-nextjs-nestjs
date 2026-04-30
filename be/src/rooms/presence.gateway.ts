import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import {
  UseGuards,
  UsePipes,
  ValidationPipe,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RoomsService } from './rooms.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { SocketStateService } from './socket-state.service';

@Injectable()
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe())
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private usersService: UsersService,
    private roomsService: RoomsService,
    private jwtService: JwtService,
    private socketState: SocketStateService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub || decoded.id;

      const existingSockets = this.socketState.getSocketIdsByUserId(userId);
      this.socketState.setSocketUser(client.id, userId);

      if (existingSockets.length === 0) {
        const userObj = await this.usersService.updateUserStatus(
          userId,
          'online',
        );
        await this.broadcastUserStatus(userId, 'online', userObj.last_seen);
      }
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketState.removeSocket(client.id);

    if (userId) {
      const remainingSockets = this.socketState.getSocketIdsByUserId(userId);
      if (remainingSockets.length === 0) {
        const userObj = await this.usersService.updateUserStatus(
          userId,
          'offline',
        );
        await this.broadcastUserStatus(userId, 'offline', userObj.last_seen);
      }

      if (this.socketState.usersInCall.has(userId)) {
        this.socketState.usersInCall.delete(userId);
      }
    }

    if (this.socketState.typingTimeouts.has(client.id)) {
      clearTimeout(this.socketState.typingTimeouts.get(client.id));
      this.socketState.typingTimeouts.delete(client.id);
    }
  }

  private async broadcastUserStatus(
    userId: string,
    status: string,
    last_seen?: Date,
  ) {
    try {
      const roomIds = await this.roomsService.getUserRoomIds(userId);
      const payload = { userId, status, last_seen };

      roomIds.forEach((roomId) => {
        this.server.to(`room-${roomId}`).emit('user-status-changed', payload);
      });

      const ownSockets = this.socketState.getSocketIdsByUserId(userId);
      ownSockets.forEach((sid) => {
        this.server.to(sid).emit('user-status-changed', payload);
      });
    } catch (err) {
      console.error('Failed to broadcast user status', err);
    }
  }
}
