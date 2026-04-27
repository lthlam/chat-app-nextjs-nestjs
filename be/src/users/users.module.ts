import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { BlockedUser } from './blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BlockedUser, FriendRequest]),
    forwardRef(() => RoomsModule),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
