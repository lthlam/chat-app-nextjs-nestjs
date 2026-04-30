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
import { MessagesGateway } from './messages.gateway';
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
  providers: [RoomsService, MessagesService, MessagesGateway],
  controllers: [RoomsController, MessagesController],
  exports: [RoomsService, MessagesService, MessagesGateway],
})
export class RoomsModule {}
