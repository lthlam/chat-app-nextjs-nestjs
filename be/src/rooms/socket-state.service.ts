import { Injectable } from '@nestjs/common';

@Injectable()
export class SocketStateService {
  public readonly userSockets: Map<string, string> = new Map(); // socketId -> userId
  public readonly typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // socketId -> timeout
  public readonly usersInCall: Map<string, string> = new Map(); // userId -> roomId
  public readonly activeCalls: Map<string, string> = new Map(); // roomId -> callerId

  getSocketIdsByUserId(userId: string): string[] {
    return Array.from(this.userSockets.entries())
      .filter(([, id]) => id === userId)
      .map(([socketId]) => socketId);
  }

  setSocketUser(socketId: string, userId: string) {
    this.userSockets.set(socketId, userId);
  }

  removeSocket(socketId: string): string | undefined {
    const userId = this.userSockets.get(socketId);
    this.userSockets.delete(socketId);
    return userId;
  }

  getUserId(socketId: string): string | undefined {
    return this.userSockets.get(socketId);
  }
}
