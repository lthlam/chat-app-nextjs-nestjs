import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';
import { BlockedUser } from './blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import * as bcrypt from 'bcryptjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FRIEND_EVENTS } from '../friends/constants/friend-events.constants';

@Injectable()
export class UsersService implements OnModuleInit {
  async onModuleInit() {
    // Reset all users to offline on startup to prevent stale status after server crash/restart
    await this.usersRepository.update(
      { status: 'online' },
      { status: 'offline' },
    );
  }

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(BlockedUser)
    private blockedUsersRepository: Repository<BlockedUser>,
    private eventEmitter: EventEmitter2,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(
    username: string,
    email: string,
    password: string,
  ): Promise<User> {
    if (username && !/^[a-z0-9]+$/.test(username)) {
      throw new BadRequestException(
        'Username must contain only lowercase letters and numbers',
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      last_seen: new Date(),
    });
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    const cacheKey = `user_profile_${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) return cached;

    const user = await this.usersRepository.findOneBy({ id });
    if (user) {
      await this.cacheManager.set(cacheKey, user, 300000); // 5 minutes
    }
    return user;
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async search(query: string): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('user.username ILIKE :query', { query: `%${query}%` })
      .orWhere('user.email ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async findExact(query: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: [{ username: query }, { email: query }],
    });
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    if (data.username) {
      if (!/^[a-z0-9]+$/.test(data.username)) {
        throw new BadRequestException('Username phải chứa ký tự thường và số');
      }
      const existing = await this.findExact(data.username);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username đã tồn tại');
      }
    }
    await this.usersRepository.update(userId, data);
    await this.cacheManager.del(`user_profile_${userId}`);
    return this.findById(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Sai mật khẩu hiện tại');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(userId, { password: hashedPassword });
    await this.cacheManager.del(`user_profile_${userId}`);
  }

  async updateUserStatus(
    userId: string,
    status: 'online' | 'offline' | 'away',
  ): Promise<User> {
    const updateData: Partial<User> = { status };
    if (status === 'offline') {
      updateData.last_seen = new Date();
    }
    await this.usersRepository.update(userId, updateData);
    await this.cacheManager.del(`user_profile_${userId}`);
    return this.findById(userId);
  }

  async blockUser(blockerId: string, blockedId: string): Promise<BlockedUser> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Không thể tự block bản thân');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const blocker = await manager.findOne(User, { where: { id: blockerId } });
      const blocked = await manager.findOne(User, { where: { id: blockedId } });

      if (!blocker || !blocked) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      // Check if already blocked
      const existing = await manager.findOne(BlockedUser, {
        where: { blocker: { id: blockerId }, blocked: { id: blockedId } },
      });
      if (existing) {
        return { savedBlockedUser: existing, wasFriends: false };
      }

      // Unfriend logic: find and remove any friend requests between them
      const deleteResult = await manager.delete(FriendRequest, [
        { sender: { id: blockerId }, receiver: { id: blockedId } },
        { sender: { id: blockedId }, receiver: { id: blockerId } },
      ]);

      const blockedUser = manager.create(BlockedUser, {
        blocker,
        blocked,
      });

      const savedBlockedUser = await manager.save(blockedUser);

      return {
        savedBlockedUser,
        wasFriends: deleteResult.affected && deleteResult.affected > 0,
      };
    });

    // Notify the blocked user after DB success
    this.eventEmitter.emit(FRIEND_EVENTS.USER_BLOCKED, {
      blockedId,
      blockerId: blockerId,
    });

    if (result.wasFriends) {
      this.eventEmitter.emit(FRIEND_EVENTS.REMOVED, {
        userId: blockerId,
        targetUserId: blockedId,
      });
    }

    return result.savedBlockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.blockedUsersRepository.delete({
      blocker: { id: blockerId },
      blocked: { id: blockedId },
    });

    // Notify the unblocked user
    this.eventEmitter.emit(FRIEND_EVENTS.USER_UNBLOCKED, {
      blockedId,
      blockerId: blockerId,
    });
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const blocked = await this.blockedUsersRepository.findOne({
      where: {
        blocker: { id: blockerId },
        blocked: { id: blockedId },
      },
    });

    return !!blocked;
  }

  async isAnyBlocked(userId1: string, userId2: string): Promise<boolean> {
    const blocked = await this.blockedUsersRepository.findOne({
      where: [
        { blocker: { id: userId1 }, blocked: { id: userId2 } },
        { blocker: { id: userId2 }, blocked: { id: userId1 } },
      ],
    });

    return !!blocked;
  }

  async getBlockedUsers(userId: string): Promise<User[]> {
    const blockedRecords = await this.blockedUsersRepository.find({
      where: { blocker: { id: userId } },
      relations: ['blocked'],
    });

    return blockedRecords.map((record) => record.blocked);
  }

  async getBlockedByUsers(userId: string): Promise<User[]> {
    const blockedRecords = await this.blockedUsersRepository.find({
      where: { blocked: { id: userId } },
      relations: ['blocker'],
    });

    return blockedRecords.map((record) => record.blocker);
  }
}
