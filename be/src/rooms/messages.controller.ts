import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private messagesGateway: MessagesGateway,
    private cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      'chat/images',
    );

    return {
      imageUrl: uploadResult.secure_url,
    };
  }

  @Get('link-preview')
  async getLinkPreview(@Query('url') url: string) {
    if (!url) throw new BadRequestException('URL is required');
    return this.messagesService.getLinkPreview(url);
  }

  @Get('global-search')
  async globalSearch(@Request() req, @Query('q') query: string) {
    if (!query) throw new BadRequestException('Query is required');
    return this.messagesService.globalSearch(req.user.id, query);
  }

  @Get(':roomId')
  async getMessages(
    @Request() req,
    @Param('roomId') roomId: string,
    @Query('limit') limit: string = '50',
    @Query('beforeId') beforeId?: string,
    @Query('afterId') afterId?: string,
  ) {
    return this.messagesService.getMessages(
      req.user.id,
      roomId,
      parseInt(limit, 10),
      beforeId,
      afterId,
    );
  }

  @Post('upload-voice')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      'chat/voices',
    );

    return { voiceUrl: uploadResult.secure_url };
  }

  @Post('upload-video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    if (!file.mimetype.startsWith('video/')) {
      throw new BadRequestException('File must be a video');
    }

    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      'chat/videos',
    );

    return { videoUrl: uploadResult.secure_url };
  }

  @Post(':messageId/delivered')
  async markAsDelivered(@Param('messageId') messageId: string) {
    const updatedMessage =
      await this.messagesService.markMessageAsDelivered(messageId);
    if (updatedMessage) {
      this.messagesGateway.server
        .to(`room-${updatedMessage.room.id}`)
        .emit('message-updated', updatedMessage);
    }
    return updatedMessage;
  }

  @Get(':roomId/search')
  async searchMessages(
    @Request() req,
    @Param('roomId') roomId: string,
    @Query('q') query: string,
  ) {
    return this.messagesService.searchMessages(roomId, req.user.id, query);
  }

  @Get(':roomId/pinned')
  async getPinnedMessages(@Request() req, @Param('roomId') roomId: string) {
    return this.messagesService.getPinnedMessages(roomId, req.user.id);
  }

  @Get(':roomId/around/:messageId')
  async getMessagesAround(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Query('limit') limit: string = '20',
    @Query('direction') direction: 'around' | 'forward' | 'backward' = 'around',
  ) {
    return this.messagesService.getMessagesAround(
      req.user.id,
      roomId,
      messageId,
      parseInt(limit, 10),
      direction,
    );
  }

  @Get(':roomId/media')
  async getMedia(@Request() req, @Param('roomId') roomId: string) {
    return this.messagesService.getMedia(roomId, req.user.id);
  }

  @Post(':roomId')
  async sendMessage(
    @Param('roomId') roomId: string,
    @Request() req,
    @Body() data: { content: string; replyToMessageId?: string; type?: any },
  ) {
    const message = await this.messagesService.sendMessage(
      roomId,
      req.user.id,
      data.content,
      data.replyToMessageId,
      data.type,
    );

    if (message) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('new-message', message);
    }

    return message;
  }

  @Post(':roomId/read')
  async markRoomAsSeen(@Param('roomId') roomId: string, @Request() req) {
    const seenPayload = await this.messagesService.markRoomAsSeen(
      roomId,
      req.user.id,
    );

    if ((seenPayload.updatedMessages || []).length > 0) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('messages-seen', seenPayload);
    }

    return seenPayload;
  }

  @Put(':messageId')
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() data: { content: string },
  ) {
    return this.messagesService.editMessage(messageId, data.content);
  }

  @Delete(':messageId')
  async deleteMessage(@Param('messageId') messageId: string) {
    const updatedMessage = await this.messagesService.deleteMessage(messageId);

    const roomId = (updatedMessage as any)?.room?.id;
    if (roomId) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('message-updated', updatedMessage);
    }

    return updatedMessage;
  }

  @Post(':messageId/reactions')
  async addReaction(
    @Param('messageId') messageId: string,
    @Request() req,
    @Body() data: { emoji: string },
  ) {
    const updatedMessage = await this.messagesService.addReaction(
      messageId,
      req.user.id,
      data.emoji,
    );

    const roomId = (updatedMessage as any)?.room?.id;
    if (roomId) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('reaction-updated', updatedMessage);
    }

    return updatedMessage;
  }

  @Delete('reactions/:reactionId')
  async removeReaction(@Param('reactionId') reactionId: string) {
    const updatedMessage =
      await this.messagesService.removeReaction(reactionId);

    const roomId = (updatedMessage as any)?.room?.id;
    if (roomId) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('reaction-updated', updatedMessage);
    }

    return updatedMessage;
  }

  @Post(':messageId/pin')
  async pinMessage(@Param('messageId') messageId: string) {
    const updatedMessage = await this.messagesService.pinMessage(messageId);
    const roomId = (updatedMessage as any)?.room?.id;
    if (roomId) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('message-updated', updatedMessage);
    }
    return updatedMessage;
  }
  @Delete(':messageId/pin')
  async unpinMessage(@Param('messageId') messageId: string) {
    const updatedMessage = await this.messagesService.unpinMessage(messageId);
    const roomId = (updatedMessage as any)?.room?.id;
    if (roomId) {
      this.messagesGateway.server
        .to(`room-${roomId}`)
        .emit('message-updated', updatedMessage);
    }
    return updatedMessage;
  }
}
