import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Message } from '../message.entity';
import { MessageReaction } from '../message-reaction.entity';
import { MessageRead } from '../message-read.entity';
import { Room } from '../room.entity';
import { User } from '../../users/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ROOM_EVENTS } from '../constants/room-events.constants';

@Injectable()
export class MessagesReactionService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(MessageReaction)
    private reactionsRepository: Repository<MessageReaction>,
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    private eventEmitter: EventEmitter2,
    private dataSource: DataSource,
  ) {}

  async addReaction(messageId: string, userId: string, emoji: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const message = await manager.getRepository(Message).findOne({
        where: { id: messageId },
        relations: [
          'room',
          'reactions',
          'reactions.user',
          'reads',
          'reads.user',
        ],
      });

      if (!message) throw new NotFoundException('Message not found');

      const isMember = message.room.members.some((m) => m.id === userId);
      if (!isMember) throw new ForbiddenException('Not a member of this room');

      const user = await manager.getRepository(User).findOneBy({ id: userId });
      if (!user) throw new NotFoundException('User not found');

      const existingReaction = message.reactions.find(
        (r) => r.user.id === userId && r.emoji === emoji,
      );

      if (existingReaction) {
        await manager
          .getRepository(MessageReaction)
          .delete(existingReaction.id);
      } else {
        const reaction = manager.getRepository(MessageReaction).create({
          message,
          user,
          emoji,
        });
        await manager.getRepository(MessageReaction).save(reaction);
      }

      const updated = await manager.getRepository(Message).findOne({
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

      return updated;
    });

    if (result) {
      this.eventEmitter.emit('message.reaction_updated', {
        roomId: result.room.id,
        message: result,
      });
    }

    return result;
  }

  async removeReaction(reactionId: string, userId: string) {
    const reaction = await this.reactionsRepository.findOne({
      where: { id: reactionId },
      relations: ['message', 'message.room', 'user'],
    });

    if (!reaction) throw new NotFoundException('Reaction not found');
    if (reaction.user.id !== userId) {
      throw new ForbiddenException('You can only remove your own reactions');
    }

    await this.reactionsRepository.delete(reactionId);

    const updated = await this.messagesRepository.findOne({
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

    if (updated) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_REACTION_UPDATED, {
        roomId: updated.room.id,
        message: updated,
      });
    }

    return updated;
  }

  async markMessageAsDelivered(messageId: string) {
    const message = await this.messagesRepository.findOneBy({ id: messageId });
    if (message && !message.delivered_at) {
      await this.messagesRepository.update(messageId, {
        delivered_at: new Date(),
      });
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
    return null;
  }

  async markRoomAsDelivered(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });
    if (!room) throw new NotFoundException('Room not found');
    const isMember = room.members.some((m) => m.id === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const result = await this.dataSource.transaction(async (manager) => {
      const undeliveredMessages = await manager
        .getRepository(Message)
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

      await manager.getRepository(Message).update(ids, {
        delivered_at: now,
      });

      const updatedMessages = await manager.getRepository(Message).find({
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

      return updatedMessages;
    });

    if (result.length > 0) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_ROOM_DELIVERED, {
        roomId,
        messages: result,
      });
    }

    return result;
  }

  async markRoomAsSeen(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });
    if (!room) throw new NotFoundException('Room not found');
    const isMember = room.members.some((m) => m.id === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const result = await this.dataSource.transaction(async (manager) => {
      const unreadMessages = await manager
        .getRepository(Message)
        .createQueryBuilder('message')
        .leftJoin('message.reads', 'read', 'read.userId = :userId', { userId })
        .where('message.roomId = :roomId', { roomId })
        .andWhere('message.senderId != :userId', { userId })
        .andWhere('read.id IS NULL')
        .getMany();

      if (unreadMessages.length === 0) {
        const user = await manager
          .getRepository(User)
          .findOneBy({ id: userId });
        return {
          roomId,
          user: user
            ? {
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
              }
            : null,
          updatedMessages: [],
        };
      }

      const user = await manager.getRepository(User).findOneBy({ id: userId });
      if (!user) throw new NotFoundException('User not found');

      const readsToSave = unreadMessages.map((message) =>
        manager.getRepository(MessageRead).create({ message, user }),
      );
      await manager.getRepository(MessageRead).save(readsToSave);

      const updatedMessages = await manager.getRepository(Message).find({
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

      const seenPayload = {
        roomId,
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
        },
        updatedMessages,
      };

      return seenPayload;
    });

    if (result.updatedMessages.length > 0) {
      this.eventEmitter.emit(ROOM_EVENTS.MESSAGE_SEEN, result);
    }

    return result;
  }
}
