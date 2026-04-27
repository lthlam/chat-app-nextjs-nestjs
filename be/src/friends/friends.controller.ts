import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get('list')
  async getFriendList(@Request() req) {
    return this.friendsService.getFriendList(req.user.id);
  }

  @Get('pending')
  async getPendingRequests(@Request() req) {
    return this.friendsService.getPendingRequests(req.user.id);
  }

  @Get('check/:userId')
  async checkFriend(@Param('userId') userId: string, @Request() req) {
    const areFriends = await this.friendsService.areFriends(
      req.user.id,
      userId,
    );
    return { areFriends };
  }

  @Post('request/:userId')
  async sendRequest(@Param('userId') userId: string, @Request() req) {
    return this.friendsService.sendFriendRequest(req.user.id, userId);
  }

  @Put('request/:requestId/accept')
  async acceptRequest(@Param('requestId') requestId: string, @Request() req) {
    return this.friendsService.acceptFriendRequest(requestId, req.user.id);
  }

  @Put('request/:requestId/reject')
  async rejectRequest(@Param('requestId') requestId: string) {
    return this.friendsService.rejectFriendRequest(requestId);
  }

  @Get('status/:userId')
  async getFriendshipStatus(@Param('userId') userId: string, @Request() req) {
    return this.friendsService.getFriendshipStatus(req.user.id, userId);
  }

  @Delete(':userId')
  async removeFriend(@Param('userId') userId: string, @Request() req) {
    return this.friendsService.removeFriend(req.user.id, userId);
  }
}
