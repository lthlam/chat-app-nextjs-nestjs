import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { Room } from './room.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { RoomClearedHistory } from './entities/room-cleared-history.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RoomClearedHistory)
    private roomClearedHistoryRepository: Repository<RoomClearedHistory>,
    private eventEmitter: EventEmitter2,
    private dataSource: DataSource,
  ) {}

  async getRooms(userId: string) {
    const rooms = await this.roomsRepository
      .createQueryBuilder('room')
      // Filter rooms by membership of current user
      .innerJoin(
        'room.members',
        'currentMember',
        'currentMember.id = :userId',
        {
          userId,
        },
      )
      // Load full members list for each room
      .leftJoinAndSelect('room.members', 'members')
      .leftJoinAndSelect('room.owner', 'owner')
      .getMany();

    if (rooms.length === 0) {
      return [];
    }

    const roomIds = rooms.map((room) => room.id);

    // Pull only the latest message id per room instead of loading full room history.
    const latestMessageRows = await this.messagesRepository
      .createQueryBuilder('message')
      .select('room.id', 'room_id')
      .addSelect('message.id', 'message_id')
      .innerJoin('message.room', 'room')
      .where('room.id IN (:...roomIds)', { roomIds })
      .distinctOn(['room.id'])
      .orderBy('room.id', 'ASC')
      .addOrderBy('message.created_at', 'DESC')
      .getRawMany<{ room_id: string; message_id: string }>();

    const latestMessageIds = latestMessageRows.map((row) => row.message_id);
    const latestMessages = latestMessageIds.length
      ? await this.messagesRepository.find({
          where: { id: In(latestMessageIds) },
          relations: ['sender', 'reads', 'reads.user'],
        })
      : [];

    const clearedHistories = await this.roomClearedHistoryRepository.find({
      where: { user: { id: userId }, room: { id: In(roomIds) } },
      relations: ['room'],
    });

    const clearedAtByRoomId = new Map(
      clearedHistories.map((ch) => [
        String(ch.room.id),
        new Date(ch.cleared_at).getTime(),
      ]),
    );

    const roomToMessageId = new Map(
      latestMessageRows.map((row) => [
        String(row.room_id),
        String(row.message_id),
      ]),
    );
    const messageById = new Map(
      latestMessages.map((message) => [String(message.id), message]),
    );

    const enrichedRooms = rooms
      .map((room) => {
        const latestMessageId = roomToMessageId.get(String(room.id));
        let lastMessage = latestMessageId
          ? messageById.get(latestMessageId)
          : null;

        const clearedAtMs = clearedAtByRoomId.get(String(room.id)) || 0;
        if (
          lastMessage &&
          clearedAtMs > 0 &&
          new Date(lastMessage.created_at).getTime() <= clearedAtMs
        ) {
          lastMessage = null;
        }

        return {
          ...room,
          members_count: room.members?.length || 0,
          cleared_at: clearedAtByRoomId.has(String(room.id))
            ? new Date(clearedAtByRoomId.get(String(room.id))!).toISOString()
            : null,
          last_message: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_id: lastMessage.sender?.id,
                sender_name: lastMessage.sender?.username,
                type: lastMessage.type,
                deleted_at: lastMessage.deleted_at,
                is_unread_for_me:
                  lastMessage.sender?.id !== userId &&
                  !(lastMessage.reads || []).some(
                    (read) => read.user?.id === userId,
                  ),
              }
            : null,
        };
      })
      .filter((room) => {
        if (room.is_group_chat) return true; // Always show groups
        const clearedAtMs = clearedAtByRoomId.get(String(room.id));
        if (!clearedAtMs) return true;
        if (!room.last_message) return false;
        const lastMessageMs = new Date(room.last_message.created_at).getTime();
        return lastMessageMs > clearedAtMs;
      });

    return enrichedRooms.sort((a: any, b: any) => {
      const aTime = a?.last_message?.created_at
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.updated_at).getTime();
      const bTime = b?.last_message?.created_at
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.updated_at).getTime();
      return bTime - aTime;
    });
  }

  async getRoomSummaryForUser(roomId: string, userId: string) {
    const rooms = await this.getRooms(userId);
    return (
      rooms.find((room: any) => String(room.id) === String(roomId)) || null
    );
  }

  async getUserRoomIds(userId: string): Promise<string[]> {
    const raw = await this.roomsRepository
      .createQueryBuilder('room')
      .select('room.id')
      .innerJoin('room.members', 'member', 'member.id = :userId', { userId })
      .getRawMany();
    return raw.map((r: any) => String(r.room_id || r.id || r.room_id_alias)); // Handle different dialect returns
  }

  async getRoom(id: string) {
    return this.roomsRepository
      .createQueryBuilder('room')
      .where('room.id = :id', { id })
      .leftJoinAndSelect('room.owner', 'owner')
      .leftJoinAndSelect('room.members', 'members')
      .leftJoinAndSelect('room.messages', 'messages')
      .getOne();
  }

  async createRoom(name: string, ownerId: string, memberIds: string[]) {
    return this.dataSource.transaction(async (manager) => {
      const owner = await manager
        .getRepository(User)
        .findOneBy({ id: ownerId });
      const members = await manager
        .getRepository(User)
        .findBy({ id: In(memberIds) });

      const room = manager.getRepository(Room).create({
        name,
        is_group_chat: memberIds.length > 1,
        owner,
        members: [owner, ...members],
      });

      const savedRoom = await manager.getRepository(Room).save(room);

      const invitedMemberIds = [
        ...new Set((memberIds || []).map(String)),
      ].filter((id) => id !== String(ownerId));

      this.eventEmitter.emit('room.created', {
        room: savedRoom,
        ownerId,
        invitedMemberIds,
      });
      return savedRoom;
    });
  }

  async updateRoom(
    roomId: string,
    data: { name?: string; avatar_url?: string | null },
  ) {
    const room = await this.roomsRepository.findOneBy({ id: roomId });
    if (!room) {
      throw new Error('Room not found');
    }

    if (data.name !== undefined) {
      room.name = data.name;
    }

    if (data.avatar_url !== undefined) {
      room.avatar_url = data.avatar_url;
    }

    return this.roomsRepository.save(room);
  }

  async addMember(roomId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const room = await manager.getRepository(Room).findOne({
        where: { id: roomId },
        relations: ['members'],
        lock: { mode: 'pessimistic_write' },
      });
      const user = await manager.getRepository(User).findOneBy({ id: userId });

      if (!room) {
        throw new Error('Room not found');
      }
      if (!user) {
        throw new Error('User not found');
      }

      if (!room.members.find((m) => m.id === userId)) {
        room.members.push(user);
        await manager.getRepository(Room).save(room);
        this.eventEmitter.emit('room.member.added', { roomId, userId });
      }

      return room;
    });
  }

  async removeMember(roomId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const room = await manager.getRepository(Room).findOne({
        where: { id: roomId },
        relations: ['owner', 'members'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!room) {
        throw new Error('Room not found');
      }

      const ownerId = String(room.owner?.id || '');

      // Remove member
      room.members = room.members.filter((m) => m.id !== userId);

      if (room.members.length === 0) {
        await manager.getRepository(Room).remove(room);
        return room;
      }

      // If owner leaves, hand over owner role to one remaining member.
      if (ownerId && ownerId === String(userId)) {
        room.owner = room.members[0];
      }

      await manager.getRepository(Room).save(room);
      this.eventEmitter.emit('room.member.removed', {
        roomId,
        userId,
        reason: 'left',
        newOwner: room.owner,
      });
      return room;
    });
  }

  async removeMemberByOwner(roomId: string, userId: string, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const room = await manager.getRepository(Room).findOne({
        where: { id: roomId },
        relations: ['owner', 'members'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!room) {
        throw new Error('Room not found');
      }

      if (String(room.owner?.id) !== String(actorId)) {
        throw new ForbiddenException(
          'Chỉ có chủ nhóm mới có quyền kick thành viên.',
        );
      }

      room.members = room.members.filter(
        (m) => String(m.id) !== String(userId),
      );
      await manager.getRepository(Room).save(room);
      this.eventEmitter.emit('room.member.removed', {
        roomId,
        userId,
        reason: 'kicked',
        newOwner: room.owner,
      });
      return room;
    });
  }

  async getGroupMembers(roomId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members'],
    });

    if (!room) {
      throw new Error('Room not found');
    }

    return room.members;
  }

  async clearRoomHistory(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOneBy({ id: roomId });
    if (!room) throw new Error('Room not found');
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) throw new Error('User not found');

    let history = await this.roomClearedHistoryRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });

    if (history) {
      history.cleared_at = new Date();
    } else {
      history = this.roomClearedHistoryRepository.create({
        room,
        user,
        cleared_at: new Date(),
      });
    }

    await this.roomClearedHistoryRepository.save(history);
    this.eventEmitter.emit('room.history.cleared', { roomId, userId });
    return history;
  }

  getIceServers() {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
    ];
  }
}
