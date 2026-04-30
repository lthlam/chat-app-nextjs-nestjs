import {
  BadRequestException,
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
import { MessagesGateway } from './messages.gateway';
import { CreateRoomDto, UpdateRoomDto, AddMemberDto } from './dto/rooms.dto';

@Controller('rooms')
@UseGuards(AuthGuard('jwt'))
export class RoomsController {
  constructor(
    private roomsService: RoomsService,
    private messagesGateway: MessagesGateway,
  ) {}

  @Get()
  async getRooms(@Request() req) {
    return this.roomsService.getRooms(req.user.id);
  }

  @Get('ice-servers')
  getIceServers() {
    return this.roomsService.getIceServers();
  }

  @Get(':id')
  async getRoom(@Param('id') id: string) {
    return this.roomsService.getRoom(id);
  }

  @Get(':id/members')
  async getGroupMembers(@Param('id') roomId: string) {
    return this.roomsService.getGroupMembers(roomId);
  }

  @Post()
  async createRoom(@Request() req, @Body() data: CreateRoomDto) {
    const room = await this.roomsService.createRoom(
      data.name || null,
      req.user.id,
      data.members || [],
    );

    const invitedUserIds = [
      ...new Set((data.members || []).map(String)),
    ].filter((memberId) => memberId !== String(req.user.id));

    await Promise.all(
      invitedUserIds.map(async (memberId) => {
        const roomSummary = await this.roomsService.getRoomSummaryForUser(
          room.id,
          memberId,
        );
        if (roomSummary) {
          this.messagesGateway.notifyUserAddedToRoom(memberId, roomSummary);
        }
      }),
    );

    return room;
  }

  @Put(':id')
  async updateRoom(@Param('id') roomId: string, @Body() data: UpdateRoomDto) {
    return this.roomsService.updateRoom(roomId, data);
  }

  @Post(':id/members')
  async addMember(@Param('id') roomId: string, @Body() data: AddMemberDto) {
    const room = await this.roomsService.addMember(roomId, data.user_id);
    const roomSummary = await this.roomsService.getRoomSummaryForUser(
      roomId,
      data.user_id,
    );

    if (roomSummary) {
      this.messagesGateway.notifyUserAddedToRoom(data.user_id, roomSummary);
    }

    return room;
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Request() req,
    @Param('id') roomId: string,
    @Param('userId') userId: string,
  ) {
    if (String(req.user.id) === String(userId)) {
      throw new BadRequestException(
        'Khong the tu xoa chinh minh. Hay dung chuc nang roi nhom.',
      );
    }

    const room = await this.roomsService.removeMemberByOwner(
      roomId,
      userId,
      req.user.id,
    );
    this.messagesGateway.notifyUserRemovedFromRoom(
      roomId,
      userId,
      'kicked',
      room.owner,
    );
    return room;
  }

  @Delete(':id/history')
  async clearRoomHistory(@Request() req, @Param('id') roomId: string) {
    return this.roomsService.clearRoomHistory(roomId, req.user.id);
  }

  @Post(':id/leave')
  async leaveRoom(@Request() req, @Param('id') roomId: string) {
    const room = await this.roomsService.removeMember(roomId, req.user.id);
    this.messagesGateway.notifyUserRemovedFromRoom(
      roomId,
      req.user.id,
      'left',
      room.owner,
    );
    return room;
  }
}
