import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Room } from './room.entity';
import { Message } from './message.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageRead } from './message-read.entity';
import { RoomClearedHistory } from './entities/room-cleared-history.entity';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesSearchService } from './services/messages-search.service';
import { MessagesReactionService } from './services/messages-reaction.service';
import { SocketStateService } from './socket-state.service';
import { PresenceGateway } from './presence.gateway';
import { ChatGateway } from './chat.gateway';
import { RoomEventsGateway } from './room-events.gateway';
import { CallGateway } from './call.gateway';
import { User } from '../users/user.entity';
import { BlockedUser } from '../users/blocked-user.entity';
import { UsersModule } from '../users/users.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      Message,
      MessageReaction,
      MessageRead,
      RoomClearedHistory,
      User,
      BlockedUser,
    ]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    UsersModule,
    CloudinaryModule,
  ],
  providers: [
    RoomsService,
    MessagesService,
    MessagesSearchService,
    MessagesReactionService,
    SocketStateService,
    PresenceGateway,
    ChatGateway,
    RoomEventsGateway,
    CallGateway,
  ],
  controllers: [RoomsController, MessagesController],
  exports: [
    RoomsService,
    MessagesService,
    MessagesSearchService,
    MessagesReactionService,
    PresenceGateway,
    ChatGateway,
    RoomEventsGateway,
    CallGateway,
  ],
})
export class RoomsModule {}
