import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository, IsNull } from 'typeorm';
import { Message } from './message.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageRead } from './message-read.entity';
import { Room } from './room.entity';
import { User } from '../users/user.entity';
import { RoomClearedHistory } from './entities/room-cleared-history.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService implements OnModuleInit {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(MessageReaction)
    private reactionsRepository: Repository<MessageReaction>,
    @InjectRepository(MessageRead)
    private readsRepository: Repository<MessageRead>,
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RoomClearedHistory)
    private roomClearedHistoryRepository: Repository<RoomClearedHistory>,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
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

  async isRoomMember(roomId: string, userId: string): Promise<boolean> {
    const count = await this.roomsRepository
      .createQueryBuilder('room')
      .innerJoin('room.members', 'member')
      .where('room.id = :roomId', { roomId })
      .andWhere('member.id = :userId', { userId })
      .getCount();

    return count > 0;
  }

  async getRoomMembers(roomId: string): Promise<User[]> {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room.members;
  }

  async isRoomGroupChat(roomId: string): Promise<boolean> {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
    });
    return room?.is_group_chat ?? false;
  }

  private getBaseQuery(roomId: string) {
    return this.messagesRepository
      .createQueryBuilder('message')
      .where('message.roomId = :roomId', { roomId })
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.reply_to', 'reply_to')
      .leftJoinAndSelect('reply_to.sender', 'reply_sender')
      .leftJoinAndSelect('message.mentions', 'mentions')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .leftJoinAndSelect('reactions.user', 'reactionUser')
      .leftJoinAndSelect('message.reads', 'reads')
      .leftJoinAndSelect('reads.user', 'readUser');
  }

  async getMessages(
    userId: string,
    roomId: string,
    limit = 20,
    beforeId?: string,
    afterId?: string,
  ) {
    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAtMs = clearedHistory
      ? new Date(clearedHistory.cleared_at).getTime()
      : 0;

    const query = this.getBaseQuery(roomId);

    if (afterId) {
      const afterMessage = await this.messagesRepository.findOneBy({
        id: afterId,
      });
      if (afterMessage) {
        query
          .andWhere(
            '(message.created_at > :afterDate OR (message.created_at = :afterDate AND message.id > :afterId))',
            {
              afterDate: afterMessage.created_at,
              afterId: afterMessage.id,
            },
          )
          .orderBy('message.created_at', 'ASC')
          .addOrderBy('message.id', 'ASC');
      }
    } else {
      query
        .orderBy('message.created_at', 'DESC')
        .addOrderBy('message.id', 'DESC');

      if (beforeId) {
        const beforeMessage = await this.messagesRepository.findOneBy({
          id: beforeId,
        });
        if (beforeMessage) {
          query.andWhere(
            '(message.created_at < :beforeDate OR (message.created_at = :beforeDate AND message.id < :beforeId))',
            {
              beforeDate: beforeMessage.created_at,
              beforeId: beforeMessage.id,
            },
          );
        }
      }
    }

    query.take(limit);

    const data = await query.getMany();

    const filteredData = data.filter((msg) => {
      return new Date(msg.created_at).getTime() > clearedAtMs;
    });

    filteredData.forEach((msg) => {
      if (
        msg.reply_to &&
        new Date(msg.reply_to.created_at).getTime() <= clearedAtMs
      ) {
        msg.reply_to.content = 'Tin nhắn không hiển thị';
        msg.reply_to.type = 'text';
      }
    });

    const sortedData = afterId ? filteredData : filteredData.reverse();

    return {
      data: sortedData,
      pagination: {
        limit,
        olderCursor: sortedData.length > 0 ? sortedData[0].id : null,
        newerCursor:
          sortedData.length > 0 ? sortedData[sortedData.length - 1].id : null,
      },
    };
  }

  async getMessagesAround(
    userId: string,
    roomId: string,
    messageId: string,
    limit = 20,
    direction: 'around' | 'forward' | 'backward' = 'around',
  ) {
    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAtMs = clearedHistory
      ? new Date(clearedHistory.cleared_at).getTime()
      : 0;
    // We use queryBuilder for target too to ensure identical relations
    const targetMessage = await this.getBaseQuery(roomId)
      .andWhere('message.id = :messageId', { messageId })
      .getOne();

    if (!targetMessage) {
      throw new NotFoundException('Target message not found');
    }

    if (
      clearedAtMs > 0 &&
      new Date(targetMessage.created_at).getTime() <= clearedAtMs
    ) {
      throw new ForbiddenException('Tin nhắn không hiển thị');
    }

    let requestedBeforeLimit = Math.floor(limit / 2) + 1;
    let requestedAfterLimit = Math.floor(limit / 2);

    if (direction === 'forward') {
      requestedBeforeLimit = 1;
      requestedAfterLimit = limit - 1;
    } else if (direction === 'backward') {
      requestedBeforeLimit = limit;
      requestedAfterLimit = 0;
    }

    // Get messages before (including target) + 1 extra for hasOlder check
    const beforeMessagesRaw =
      requestedBeforeLimit > 0
        ? await this.getBaseQuery(roomId)
            .andWhere(
              '(message.created_at < :targetDate OR (message.created_at = :targetDate AND message.id <= :targetId))',
              {
                targetDate: targetMessage.created_at,
                targetId: targetMessage.id,
              },
            )
            .orderBy('message.created_at', 'DESC')
            .addOrderBy('message.id', 'DESC')
            .take(requestedBeforeLimit + 1)
            .getMany()
        : [];

    const hasOlder = beforeMessagesRaw.length > requestedBeforeLimit;
    const beforeMessages = hasOlder
      ? beforeMessagesRaw.slice(0, requestedBeforeLimit)
      : beforeMessagesRaw;

    // Get messages after + 1 extra for hasNewer check
    const afterMessagesRaw =
      requestedAfterLimit > 0
        ? await this.getBaseQuery(roomId)
            .andWhere(
              '(message.created_at > :targetDate OR (message.created_at = :targetDate AND message.id > :targetId))',
              {
                targetDate: targetMessage.created_at,
                targetId: targetMessage.id,
              },
            )
            .orderBy('message.created_at', 'ASC')
            .addOrderBy('message.id', 'ASC')
            .take(requestedAfterLimit + 1)
            .getMany()
        : [];

    const hasNewer = afterMessagesRaw.length > requestedAfterLimit;
    const afterMessages = hasNewer
      ? afterMessagesRaw.slice(0, requestedAfterLimit)
      : afterMessagesRaw;

    const combined = [...beforeMessages.reverse(), ...afterMessages].sort(
      (a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      },
    );

    const filteredCombined = combined.filter((msg) => {
      return new Date(msg.created_at).getTime() > clearedAtMs;
    });

    filteredCombined.forEach((msg) => {
      if (
        msg.reply_to &&
        new Date(msg.reply_to.created_at).getTime() <= clearedAtMs
      ) {
        msg.reply_to.content = 'Tin nhắn không hiển thị';
        msg.reply_to.type = 'text';
      }
    });

    return {
      data: filteredCombined,
      pagination: {
        limit,
        olderCursor:
          filteredCombined.length > 0 ? filteredCombined[0].id : undefined,
        newerCursor:
          filteredCombined.length > 0
            ? filteredCombined[filteredCombined.length - 1].id
            : undefined,
        hasOlder,
        hasNewer,
      },
    };
  }

  async getPinnedMessages(roomId: string, userId: string) {
    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAtMs = clearedHistory
      ? new Date(clearedHistory.cleared_at).getTime()
      : 0;

    const messages = await this.messagesRepository.find({
      where: { room: { id: roomId }, is_pinned: true, deleted_at: IsNull() },
      relations: [
        'sender',
        'reply_to',
        'reply_to.sender',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
      order: { created_at: 'DESC' },
    });

    messages.forEach((msg) => {
      // Scrub pinned message itself if before clear boundary
      if (
        clearedAtMs > 0 &&
        new Date(msg.created_at).getTime() <= clearedAtMs
      ) {
        msg.content = 'Tin nhắn không hiển thị';
        msg.type = 'text';
      }
      // Scrub reply_to if before clear boundary
      if (
        msg.reply_to &&
        clearedAtMs > 0 &&
        new Date(msg.reply_to.created_at).getTime() <= clearedAtMs
      ) {
        msg.reply_to.content = 'Tin nhắn không hiển thị';
        msg.reply_to.type = 'text';
      }
    });

    return messages;
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    replyToMessageId?: string,
    type: 'text' | 'image' | 'call' | 'voice' | 'album' | 'video' = 'text',
    mentions?: string[],
  ) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });
    const sender = await this.usersRepository.findOneBy({ id: senderId });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!sender) {
      throw new NotFoundException('User not found');
    }

    const isMember = room.members.some((member) => member.id === senderId);
    if (!isMember) {
      throw new ForbiddenException('You are no longer a member of this room');
    }

    // Check for blocks in personal chats
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

    // Auto-detect image type if not specified
    let finalType = type;
    if (finalType === 'text') {
      const isImage =
        content.startsWith('data:image/') ||
        /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(content) ||
        /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content);
      if (isImage) {
        finalType = 'image';
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

    // Return with relations
    return this.messagesRepository.findOne({
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
  }

  async markMessageAsDelivered(messageId: string) {
    const message = await this.messagesRepository.findOneBy({ id: messageId });
    if (message && !message.delivered_at) {
      await this.messagesRepository.update(messageId, {
        delivered_at: new Date(),
      });
      return this.messagesRepository.findOne({
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
    }
    return null;
  }

  async markRoomAsDelivered(roomId: string, userId: string) {
    // Find all messages in the room NOT sent by this user AND NOT yet delivered
    const undeliveredMessages = await this.messagesRepository
      .createQueryBuilder('message')
      .where('message.roomId = :roomId', { roomId })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('message.delivered_at IS NULL')
      .getMany();

    if (undeliveredMessages.length === 0) {
      return [];
    }

    const now = new Date();
    const ids = undeliveredMessages.map((m) => m.id);

    await this.messagesRepository.update(ids, {
      delivered_at: now,
    });

    return this.messagesRepository.find({
      where: { id: In(ids) },
      relations: [
        'room',
        'sender',
        'reply_to',
        'reply_to.sender',
        'reactions',
        'reactions.user',
        'reads',
        'reads.user',
      ],
    });
  }

  async editMessage(messageId: string, content: string) {
    await this.messagesRepository.update(messageId, { content });
    return this.messagesRepository.findOne({
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
  }

  async deleteMessage(messageId: string) {
    // Soft delete - just set deleted_at timestamp
    await this.messagesRepository.update(messageId, {
      deleted_at: new Date(),
      content: 'Tin nhắn này đã bị xoá',
      is_pinned: false,
    });

    return this.messagesRepository.findOne({
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
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: ['room', 'reactions', 'reactions.user', 'reads', 'reads.user'],
    });
    const user = await this.usersRepository.findOneBy({ id: userId });

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => r.user.id === userId && r.emoji === emoji,
    );

    if (existingReaction) {
      // Remove the reaction
      await this.reactionsRepository.delete(existingReaction.id);
    } else {
      // Add the reaction
      const reaction = this.reactionsRepository.create({
        message,
        user,
        emoji,
      });
      await this.reactionsRepository.save(reaction);
    }

    // Return updated message with reactions
    return this.messagesRepository.findOne({
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
  }

  async removeReaction(reactionId: string) {
    const reaction = await this.reactionsRepository.findOne({
      where: { id: reactionId },
      relations: ['message', 'message.room'],
    });

    if (!reaction) return null;

    await this.reactionsRepository.delete(reactionId);

    return this.messagesRepository.findOne({
      where: { id: reaction.message.id },
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
  }

  async searchMessages(roomId: string, userId: string, query: string) {
    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAt = clearedHistory ? clearedHistory.cleared_at : new Date(0);

    const messages = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.room', 'room')
      .where('room.id = :roomId', { roomId })
      .andWhere('message.type = :type', { type: 'text' })
      .andWhere('message.created_at > :clearedAt', { clearedAt })
      .andWhere('unaccent(message.content) ILIKE unaccent(:query)', {
        query: `%${query}%`,
      })
      .andWhere('message.deleted_at IS NULL')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.reply_to', 'reply_to')
      .leftJoinAndSelect('reply_to.sender', 'reply_sender')
      .leftJoinAndSelect('message.mentions', 'mentions')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .leftJoinAndSelect('reactions.user', 'user')
      .leftJoinAndSelect('message.reads', 'reads')
      .leftJoinAndSelect('reads.user', 'readUser')
      .orderBy('message.created_at', 'ASC')
      .getMany();

    const clearedAtMs = clearedAt.getTime();
    messages.forEach((msg) => {
      if (
        msg.reply_to &&
        new Date(msg.reply_to.created_at).getTime() <= clearedAtMs
      ) {
        msg.reply_to.content = 'Tin nhắn không hiển thị';
        msg.reply_to.type = 'text';
      }
    });

    return messages;
  }

  async globalSearch(userId: string, query: string) {
    // FTS over messages where user is a member of the room
    // Filter by cleared_at history per room
    const result = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoinAndSelect('message.room', 'room')
      .innerJoin('room.members', 'member')
      .leftJoin(
        RoomClearedHistory,
        'cleared',
        'cleared.room = room.id AND cleared.user = :userId',
        { userId },
      )
      .where('member.id = :userId', { userId })
      .andWhere(
        "message.search_vector @@ plainto_tsquery('simple', public.f_unaccent(:query))",
        { query },
      )
      .andWhere(
        '(cleared.cleared_at IS NULL OR message.created_at > cleared.cleared_at)',
      )
      .andWhere('message.deleted_at IS NULL')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.reply_to', 'reply_to')
      .leftJoinAndSelect('reply_to.sender', 'reply_sender')
      .leftJoinAndSelect('room.members', 'allMembers')
      .select([
        'message',
        'room',
        'member',
        'sender',
        'reply_to',
        'reply_sender',
        'allMembers',
        'cleared.cleared_at',
      ])
      .orderBy(
        `ts_rank(message.search_vector, plainto_tsquery('simple', public.f_unaccent(:query)))`,
        'DESC',
      )
      .addOrderBy('message.created_at', 'DESC')
      .limit(50)
      .getRawAndEntities();

    return result.entities.map((msg) => {
      // Find the raw result for this entity
      const raw = result.raw.find((r) => r.message_id === msg.id);
      const clearedAt = raw?.cleared_cleared_at;

      if (msg.reply_to && clearedAt) {
        if (
          new Date(msg.reply_to.created_at).getTime() <=
          new Date(clearedAt).getTime()
        ) {
          msg.reply_to.content = 'Tin nhắn không hiển thị';
          msg.reply_to.type = 'text';
        }
      }
      return msg;
    });
  }

  async pinMessage(messageId: string) {
    await this.messagesRepository.update(messageId, { is_pinned: true });
    return this.messagesRepository.findOne({
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
  }

  async unpinMessage(messageId: string) {
    await this.messagesRepository.update(messageId, { is_pinned: false });
    return this.messagesRepository.findOne({
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
  }

  async markRoomAsSeen(roomId: string, userId: string) {
    const isMember = await this.isRoomMember(roomId, userId);
    if (!isMember) {
      return { roomId, user: null, updatedMessages: [] };
    }

    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      return { roomId, user: null, updatedMessages: [] };
    }

    // Find unread messages specifically
    const unreadMessages = await this.messagesRepository
      .createQueryBuilder('message')
      .leftJoin('message.reads', 'read', 'read.userId = :userId', { userId })
      .where('message.roomId = :roomId', { roomId })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('read.id IS NULL')
      .getMany();

    if (unreadMessages.length === 0) {
      return {
        roomId,
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
        },
        updatedMessages: [],
      };
    }

    const readsToSave = unreadMessages.map((message) =>
      this.readsRepository.create({ message, user }),
    );
    await this.readsRepository.save(readsToSave);

    const updatedMessages = await this.messagesRepository.find({
      where: { id: In(unreadMessages.map((message) => message.id)) },
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
      order: { created_at: 'ASC' },
    });

    return {
      roomId,
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
      },
      updatedMessages,
    };
  }

  async getMedia(roomId: string, userId: string) {
    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAt = clearedHistory ? clearedHistory.cleared_at : new Date(0);

    const media = await this.messagesRepository.find({
      where: [
        {
          room: { id: roomId },
          type: 'image',
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
        {
          room: { id: roomId },
          type: 'video',
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
        {
          room: { id: roomId },
          type: 'album',
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
        {
          room: { id: roomId },
          type: 'voice',
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
      ],
      relations: ['sender', 'reply_to', 'reply_to.sender'],
      order: { created_at: 'DESC' },
    });

    const clearedAtMs = clearedAt.getTime();
    return media.map((msg) => {
      if (
        msg.reply_to &&
        new Date(msg.reply_to.created_at).getTime() <= clearedAtMs
      ) {
        msg.reply_to.content = 'Tin nhắn không hiển thị';
        msg.reply_to.type = 'text';
      }
      return msg;
    });
  }

  async getLinkPreview(url: string) {
    try {
      const { default: axios } = await import('axios');
      const { load } = await import('cheerio');

      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000,
      });
      const $ = load(response.data);

      const getMeta = (prop: string) =>
        $(`meta[property="${prop}"]`).attr('content') ||
        $(`meta[name="${prop}"]`).attr('content');

      return {
        url,
        title: getMeta('og:title') || $('title').text() || url,
        description: getMeta('og:description') || getMeta('description') || '',
        image: getMeta('og:image') || '',
        siteName: getMeta('og:site_name') || '',
      };
    } catch (e) {
      return { url, title: url, description: '', image: '', siteName: '' };
    }
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
      throw new NotFoundException('Original message not found');
    }

    const room = await this.roomsRepository.findOne({
      where: { id: targetRoomId },
      relations: ['members'],
    });

    if (!room) {
      throw new NotFoundException('Target room not found');
    }

    const sender = await this.usersRepository.findOneBy({ id: senderId });
    if (!sender) {
      throw new NotFoundException('User not found');
    }

    const isMember = room.members.some((member) => member.id === senderId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of the target room');
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

    return this.messagesRepository.findOne({
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
  }
}
