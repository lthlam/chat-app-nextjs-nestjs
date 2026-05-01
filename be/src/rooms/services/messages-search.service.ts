import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { Message } from '../message.entity';
import { Room } from '../room.entity';
import { RoomClearedHistory } from '../entities/room-cleared-history.entity';
import { MessageType } from '../enums/message-type.enum';

@Injectable()
export class MessagesSearchService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(RoomClearedHistory)
    private roomClearedHistoryRepository: Repository<RoomClearedHistory>,
  ) {}

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

  async isRoomMember(roomId: string, userId: string): Promise<boolean> {
    const count = await this.roomsRepository
      .createQueryBuilder('room')
      .innerJoin('room.members', 'member')
      .where('room.id = :roomId', { roomId })
      .andWhere('member.id = :userId', { userId })
      .getCount();

    return count > 0;
  }

  async getRoomMembers(roomId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });
    return room ? room.members : [];
  }

  async isRoomGroupChat(roomId: string): Promise<boolean> {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      select: ['is_group_chat'],
    });
    return room ? room.is_group_chat : false;
  }

  async getMessages(
    userId: string,
    roomId: string,
    limit = 20,
    beforeId?: string,
    afterId?: string,
  ) {
    const isMember = await this.isRoomMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

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
        msg.reply_to.type = MessageType.TEXT;
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
    const isMember = await this.isRoomMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAtMs = clearedHistory
      ? new Date(clearedHistory.cleared_at).getTime()
      : 0;
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
        msg.reply_to.type = MessageType.TEXT;
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
    const isMember = await this.isRoomMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

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
      if (
        clearedAtMs > 0 &&
        new Date(msg.created_at).getTime() <= clearedAtMs
      ) {
        msg.content = 'Tin nhắn không hiển thị';
        msg.type = MessageType.TEXT;
      }
      if (
        msg.reply_to &&
        clearedAtMs > 0 &&
        new Date(msg.reply_to.created_at).getTime() <= clearedAtMs
      ) {
        msg.reply_to.content = 'Tin nhắn không hiển thị';
        msg.reply_to.type = MessageType.TEXT;
      }
    });

    return messages;
  }

  async searchMessages(roomId: string, userId: string, query: string) {
    const isMember = await this.isRoomMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAt = clearedHistory ? clearedHistory.cleared_at : new Date(0);

    const messages = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.room', 'room')
      .where('room.id = :roomId', { roomId })
      .andWhere('message.type = :type', { type: MessageType.TEXT })
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
        msg.reply_to.type = MessageType.TEXT;
      }
    });

    return messages;
  }

  async globalSearch(userId: string, query: string) {
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
      const raw = result.raw.find((r) => r.message_id === msg.id);
      const clearedAt = raw?.cleared_cleared_at;

      if (msg.reply_to && clearedAt) {
        if (
          new Date(msg.reply_to.created_at).getTime() <=
          new Date(clearedAt).getTime()
        ) {
          msg.reply_to.content = 'Tin nhắn không hiển thị';
          msg.reply_to.type = MessageType.TEXT;
        }
      }
      return msg;
    });
  }

  async getMedia(roomId: string, userId: string) {
    const isMember = await this.isRoomMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const clearedHistory = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    const clearedAt = clearedHistory ? clearedHistory.cleared_at : new Date(0);

    const media = await this.messagesRepository.find({
      where: [
        {
          room: { id: roomId },
          type: MessageType.IMAGE,
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
        {
          room: { id: roomId },
          type: MessageType.VIDEO,
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
        {
          room: { id: roomId },
          type: MessageType.ALBUM,
          created_at: MoreThan(clearedAt),
          deleted_at: IsNull(),
        },
        {
          room: { id: roomId },
          type: MessageType.VOICE,
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
        msg.reply_to.type = MessageType.TEXT;
      }
      return msg;
    });
  }
}
