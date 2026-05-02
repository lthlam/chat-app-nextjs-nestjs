import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Message } from './message.entity';
import { Room } from './room.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { MessageType } from './enums/message-type.enum';
import { ROOM_EVENTS } from './constants/room-events.constants';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class MessagesService implements OnModuleInit {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private usersService: UsersService,
    private eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    try {
      await this.messagesRepository.query(
        'CREATE EXTENSION IF NOT EXISTS unaccent;',
      );
    } catch (e) {
      console.warn('Could not enable unaccent extension:', e.message);
    }
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    replyToMessageId?: string,
    type: MessageType = MessageType.TEXT,
    mentions?: string[],
  ) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });
    const sender = await this.usersRepository.findOneBy({ id: senderId });

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }

    if (!sender) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const isMember = room.members.some((member) => member.id === senderId);
    if (!isMember) {
      throw new ForbiddenException('Không phải là thành viên của phòng');
    }

    if (!room.is_group_chat) {
      const otherMember = room.members.find((m) => m.id !== senderId);
      if (otherMember) {
        const isBlocked = await this.usersService.isAnyBlocked(
          senderId,
          otherMember.id,
        );
        if (isBlocked) {
          throw new ForbiddenException(
            'Bạn không thể gửi tin nhắn cho người này.',
          );
        }
      }
    }

    let replyToMessage: Message | null = null;
    if (replyToMessageId) {
      replyToMessage = await this.messagesRepository.findOne({
        where: { id: replyToMessageId, room: { id: roomId } },
      });
    }

    let finalType = type;
    if (finalType === MessageType.TEXT) {
      const isImage =
        content.startsWith('data:image/') ||
        /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(content) ||
        /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content);
      if (isImage) {
        finalType = MessageType.IMAGE;
      }
    }

    let mentionUsers: User[] = [];
    if (mentions && mentions.length > 0) {
      mentionUsers = await this.usersRepository.findBy({ id: In(mentions) });
    }

    const message = this.messagesRepository.create({
      room,
      sender,
      content,
      type: finalType,
      reply_to: replyToMessage,
      mentions: mentionUsers,
    });

    const savedMessage = await this.messagesRepository.save(message);

    const finalMessage = await this.messagesRepository.findOne({
      where: { id: savedMessage.id },
      relations: [
        'room',
        'sender',
        'reply_to',
        'reply_to.sender',
        'mentions',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });

    if (finalMessage) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_SENT, {
        roomId,
        message: finalMessage,
      });
    }

    await this.invalidateCacheForMembers(room.members);

    return finalMessage;
  }

  async forwardMessage(
    originalMessageId: string,
    targetRoomId: string,
    senderId: string,
  ) {
    const originalMessage = await this.messagesRepository.findOne({
      where: { id: originalMessageId },
    });

    if (!originalMessage) {
      throw new NotFoundException('Không tìm thấy tin nhắn gốc');
    }

    const room = await this.roomsRepository.findOne({
      where: { id: targetRoomId },
      relations: ['members'],
    });

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }

    const sender = await this.usersRepository.findOneBy({ id: senderId });
    if (!sender) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const isMember = room.members.some((member) => member.id === senderId);
    if (!isMember) {
      throw new ForbiddenException('Không phải là thành viên của phòng');
    }

    if (!room.is_group_chat) {
      const otherMember = room.members.find((m) => m.id !== senderId);
      if (otherMember) {
        const isBlocked = await this.usersService.isAnyBlocked(
          senderId,
          otherMember.id,
        );
        if (isBlocked) {
          throw new ForbiddenException(
            'Bạn không thể gửi tin nhắn cho người này.',
          );
        }
      }
    }

    const message = this.messagesRepository.create({
      room,
      sender,
      content: originalMessage.content,
      type: originalMessage.type,
      is_forwarded: true,
    });

    const savedMessage = await this.messagesRepository.save(message);

    const finalMessage = await this.messagesRepository.findOne({
      where: { id: savedMessage.id },
      relations: [
        'room',
        'sender',
        'reply_to',
        'reply_to.sender',
        'mentions',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });

    if (finalMessage) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_SENT, {
        roomId: targetRoomId,
        message: finalMessage,
      });
    }

    return finalMessage;
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: ['sender'],
    });

    if (!message) throw new NotFoundException('Không tìm thấy tin nhắn');
    if (message.sender.id !== userId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình',
      );
    }

    await this.messagesRepository.update(messageId, { content });
    const updated = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: [
        'room',
        'room.members',
        'sender',
        'reply_to',
        'reply_to.sender',
        'mentions',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });

    if (updated) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_UPDATED, {
        roomId: updated.room.id,
        message: updated,
      });
      await this.invalidateCacheForMembers(updated.room.members);
    }

    return updated;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: ['sender'],
    });

    if (!message) throw new NotFoundException('Không tìm thấy tin nhắn');
    if (message.sender.id !== userId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể xoá tin nhắn của chính mình',
      );
    }

    await this.messagesRepository.update(messageId, {
      deleted_at: new Date(),
      content: 'Tin nhắn này đã bị xoá',
      is_pinned: false,
    });

    const updated = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: [
        'room',
        'room.members',
        'sender',
        'reply_to',
        'reply_to.sender',
        'mentions',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });

    if (updated) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_UPDATED, {
        roomId: updated.room.id,
        message: updated,
      });
      await this.invalidateCacheForMembers(updated.room.members);
    }

    return updated;
  }

  async pinMessage(messageId: string, userId: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: ['room', 'room.members'],
    });

    if (!message) throw new NotFoundException('Không tìm thấy tin nhắn');
    const isMember = message.room.members.some((m) => m.id === userId);
    if (!isMember)
      throw new ForbiddenException('Không phải là thành viên của phòng');

    await this.messagesRepository.update(messageId, { is_pinned: true });
    const updated = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: [
        'room',
        'sender',
        'reply_to',
        'reply_to.sender',
        'mentions',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });

    if (updated) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_UPDATED, {
        roomId: updated.room.id,
        message: updated,
      });
    }

    return updated;
  }

  async unpinMessage(messageId: string, userId: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: ['room', 'room.members'],
    });

    if (!message) throw new NotFoundException('Không tìm thấy tin nhắn');
    const isMember = message.room.members.some((m) => m.id === userId);
    if (!isMember)
      throw new ForbiddenException('Không phải là thành viên của phòng');

    await this.messagesRepository.update(messageId, { is_pinned: false });
    const updated = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: [
        'room',
        'sender',
        'reply_to',
        'reply_to.sender',
        'mentions',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });

    if (updated) {
      this.eventEmitter.emit('message.updated', {
        roomId: updated.room.id,
        message: updated,
      });
    }

    return updated;
  }

  async getLinkPreview(url: string) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000,
      });
      const $ = cheerio.load(response.data);

      const title =
        $('meta[property="og:title"]').attr('content') || $('title').text();
      const description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content');
      const image =
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content');
      const siteName = $('meta[property="og:site_name"]').attr('content');

      return {
        url,
        title: title || url,
        description: description || '',
        image: image || '',
        siteName: siteName || '',
      };
    } catch (error) {
      return { url, title: url, description: '', image: '', siteName: '' };
    }
  }

  private async invalidateCacheForMembers(members: User[]) {
    if (!members) return;
    await Promise.all(
      members.map((m) => this.cacheManager.del(`user_rooms_${m.id}`)),
    );
  }
}
