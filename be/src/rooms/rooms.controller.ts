import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomDto, AddMemberDto } from './dto/rooms.dto';

@Controller('rooms')
@UseGuards(AuthGuard('jwt'))
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  async getRooms(@Request() req) {
    return this.roomsService.getRooms(req.user.id);
  }

  @Get(':id')
  async getRoom(@Request() req, @Param('id') id: string) {
    return this.roomsService.getRoom(id, req.user.id);
  }

  @Get(':id/members')
  async getGroupMembers(@Param('id') roomId: string) {
    return this.roomsService.getGroupMembers(roomId);
  }

  @Post()
  async createRoom(@Request() req, @Body() data: CreateRoomDto) {
    return this.roomsService.createRoom(
      data.name || null,
      req.user.id,
      data.members || [],
    );
  }

  @Put(':id')
  async updateRoom(
    @Request() req,
    @Param('id') roomId: string,
    @Body() data: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(roomId, req.user.id, data);
  }

  @Post(':id/members')
  async addMember(
    @Request() req,
    @Param('id') roomId: string,
    @Body() data: AddMemberDto,
  ) {
    return this.roomsService.addMember(roomId, data.user_id, req.user.id);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Request() req,
    @Param('id') roomId: string,
    @Param('userId') userId: string,
  ) {
    return this.roomsService.removeMemberByOwner(roomId, userId, req.user.id);
  }

  @Delete(':id/history')
  async clearRoomHistory(@Request() req, @Param('id') roomId: string) {
    return this.roomsService.clearRoomHistory(roomId, req.user.id);
  }

  @Post(':id/leave')
  async leaveRoom(@Request() req, @Param('id') roomId: string) {
    return this.roomsService.removeMember(roomId, req.user.id);
  }
}
