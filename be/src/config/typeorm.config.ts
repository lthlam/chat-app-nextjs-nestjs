import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { BlockedUser } from '../users/blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import { Room } from '../rooms/room.entity';
import { Message } from '../rooms/message.entity';
import { MessageReaction } from '../rooms/message-reaction.entity';
import { MessageRead } from '../rooms/message-read.entity';
import { RoomClearedHistory } from '../rooms/entities/room-cleared-history.entity';

@Injectable()
export class TypeOrmConfigService {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USER'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      entities: [
        User,
        BlockedUser,
        FriendRequest,
        Room,
        Message,
        MessageReaction,
        MessageRead,
        RoomClearedHistory,
      ],
      synchronize: this.configService.get('NODE_ENV') !== 'production',
      logging: false,
      ssl:
        this.configService.get('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
    };
  }
}
