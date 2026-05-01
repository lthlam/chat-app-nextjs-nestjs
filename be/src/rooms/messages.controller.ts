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
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { MessagesSearchService } from './services/messages-search.service';
import { MessagesReactionService } from './services/messages-reaction.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  SendMessageDto,
  UpdateMessageDto,
  AddReactionDto,
  ForwardMessageDto,
} from './dto/rooms.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private searchService: MessagesSearchService,
    private reactionService: MessagesReactionService,
    private cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png|gif|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
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
    return this.searchService.globalSearch(req.user.id, query);
  }

  @Get(':roomId')
  async getMessages(
    @Request() req,
    @Param('roomId') roomId: string,
    @Query('limit') limit: string = '50',
    @Query('beforeId') beforeId?: string,
    @Query('afterId') afterId?: string,
  ) {
    return this.searchService.getMessages(
      req.user.id,
      roomId,
      parseInt(limit, 10),
      beforeId,
      afterId,
    );
  }

  @Post('upload-voice')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVoice(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: '.(webm|ogg|mp3|wav|m4a)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      'chat/voices',
    );

    return { voiceUrl: uploadResult.secure_url };
  }

  @Post('upload-video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: '.(mp4|mov|avi|mkv|webm)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      'chat/videos',
    );

    return { videoUrl: uploadResult.secure_url };
  }

  @Post(':messageId/delivered')
  async markAsDelivered(@Param('messageId') messageId: string) {
    return this.reactionService.markMessageAsDelivered(messageId);
  }

  @Get(':roomId/search')
  async searchMessages(
    @Request() req,
    @Param('roomId') roomId: string,
    @Query('q') query: string,
  ) {
    return this.searchService.searchMessages(roomId, req.user.id, query);
  }

  @Get(':roomId/pinned')
  async getPinnedMessages(@Request() req, @Param('roomId') roomId: string) {
    return this.searchService.getPinnedMessages(roomId, req.user.id);
  }

  @Get(':roomId/around/:messageId')
  async getMessagesAround(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Query('limit') limit: string = '20',
    @Query('direction') direction: 'around' | 'forward' | 'backward' = 'around',
  ) {
    return this.searchService.getMessagesAround(
      req.user.id,
      roomId,
      messageId,
      parseInt(limit, 10),
      direction,
    );
  }

  @Get(':roomId/media')
  async getMedia(@Request() req, @Param('roomId') roomId: string) {
    return this.searchService.getMedia(roomId, req.user.id);
  }

  @Post(':roomId')
  async sendMessage(
    @Param('roomId') roomId: string,
    @Request() req,
    @Body() data: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      roomId,
      req.user.id,
      data.content,
      data.replyToMessageId,
      data.type,
    );
  }

  @Post('forward')
  async forwardMessage(@Request() req, @Body() data: ForwardMessageDto) {
    return this.messagesService.forwardMessage(
      data.messageId,
      data.targetRoomId,
      req.user.id,
    );
  }

  @Post(':roomId/read')
  async markRoomAsSeen(@Param('roomId') roomId: string, @Request() req) {
    return this.reactionService.markRoomAsSeen(roomId, req.user.id);
  }

  @Put(':messageId')
  async editMessage(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() data: UpdateMessageDto,
  ) {
    return this.messagesService.editMessage(
      messageId,
      req.user.id,
      data.content,
    );
  }

  @Delete(':messageId')
  async deleteMessage(@Request() req, @Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(messageId, req.user.id);
  }

  @Post(':messageId/reactions')
  async addReaction(
    @Param('messageId') messageId: string,
    @Request() req,
    @Body() data: AddReactionDto,
  ) {
    return this.reactionService.addReaction(messageId, req.user.id, data.emoji);
  }

  @Delete('reactions/:reactionId')
  async removeReaction(
    @Request() req,
    @Param('reactionId') reactionId: string,
  ) {
    return this.reactionService.removeReaction(reactionId, req.user.id);
  }

  @Post(':messageId/pin')
  async pinMessage(@Request() req, @Param('messageId') messageId: string) {
    return this.messagesService.pinMessage(messageId, req.user.id);
  }

  @Delete(':messageId/pin')
  async unpinMessage(@Request() req, @Param('messageId') messageId: string) {
    return this.messagesService.unpinMessage(messageId, req.user.id);
  }
}
