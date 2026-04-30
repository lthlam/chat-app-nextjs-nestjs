import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { BlockedUser } from './blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('UsersService.blockUser (Debug)', () => {
  let service: UsersService;
  let dataSource: DataSource;

  const mockUser = { id: 'user-1' };
  const mockTarget = { id: 'user-2' };

  const mockManager = {
    findOne: jest.fn().mockImplementation((entity, options) => {
        if (entity === User) {
            if (options.where.id === 'user-1') return Promise.resolve(mockUser);
            if (options.where.id === 'user-2') return Promise.resolve(mockTarget);
        }
        return Promise.resolve(null);
    }),
    delete: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockImplementation((entity, data) => data),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(BlockedUser), useValue: {} },
        { provide: getRepositoryToken(FriendRequest), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should block user and delete friend requests', async () => {
    const result = await service.blockUser('user-1', 'user-2');
    
    expect(result.blocker.id).toBe('user-1');
    expect(result.blocked.id).toBe('user-2');
    expect(mockManager.delete).toHaveBeenCalledWith(FriendRequest, [
      { sender: { id: 'user-1' }, receiver: { id: 'user-2' } },
      { sender: { id: 'user-2' }, receiver: { id: 'user-1' } },
    ]);
  });
});
