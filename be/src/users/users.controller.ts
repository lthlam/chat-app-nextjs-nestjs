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
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './change-password.dto';
import { UpdateUserDto } from './dto/users.dto';
import { SearchUserDto } from './dto/search-user.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('search')
  async search(@Query() query: SearchUserDto) {
    return this.usersService.search(query.q);
  }

  @Get('find-exact')
  async getExact(@Query() query: SearchUserDto) {
    return this.usersService.findExact(query.q);
  }

  @Get(':id')
  async getProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  async updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(id, data);
  }

  @Put(':id/password')
  async changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  @Post(':id/block')
  async blockUser(
    @Request() req,
    @Param('id', ParseUUIDPipe) blockedId: string,
  ) {
    return this.usersService.blockUser(req.user.id, blockedId);
  }

  @Delete(':id/block')
  async unblockUser(
    @Request() req,
    @Param('id', ParseUUIDPipe) blockedId: string,
  ) {
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
