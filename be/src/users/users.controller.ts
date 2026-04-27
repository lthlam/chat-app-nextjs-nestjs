import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Query,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './change-password.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('search')
  async search(@Query('q') query: string) {
    if (!query) return [];
    return this.usersService.search(query);
  }

  @Get('find-exact')
  async getExact(@Query('q') query: string) {
    if (!query) return null;
    return this.usersService.findExact(query);
  }

  @Get(':id(^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$)')
  async getProfile(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  async updateProfile(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateProfile(id, data);
  }

  @Put(':id/password')
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    try {
      await this.usersService.changePassword(
        id,
        dto.currentPassword,
        dto.newPassword,
      );
      return { message: 'Password changed successfully' };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/block')
  async blockUser(@Request() req, @Param('id') blockedId: string) {
    return this.usersService.blockUser(req.user.id, blockedId);
  }

  @Delete(':id/block')
  async unblockUser(@Request() req, @Param('id') blockedId: string) {
    await this.usersService.unblockUser(req.user.id, blockedId);
    return { message: 'User unblocked' };
  }

  @Get('blocked/list')
  async getBlockedUsers(@Request() req) {
    return this.usersService.getBlockedUsers(req.user.id);
  }

  @Get('blocked-by/list')
  async getBlockedByUsers(@Request() req) {
    return this.usersService.getBlockedByUsers(req.user.id);
  }
}
