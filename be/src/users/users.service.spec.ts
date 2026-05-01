import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { BlockedUser } from './blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { FRIEND_EVENTS } from '../friends/constants/friend-events.constants';

describe('UsersService', () => {
  let service: UsersService;

  const mockUsersRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const mockBlockedUsersRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const mockFriendRequestRepository = {
    delete: jest.fn(),
  };
  const mockEventEmitter = {
    emit: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) =>
      cb({
        findOne: jest.fn().mockImplementation((entity) => {
          if (entity === User) return Promise.resolve({ id: '1' });
          return Promise.resolve(null);
        }),
        delete: jest.fn(),
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({ id: 'block-id' }),
      }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        {
          provide: getRepositoryToken(BlockedUser),
          useValue: mockBlockedUsersRepository,
        },
        {
          provide: getRepositoryToken(FriendRequest),
          useValue: mockFriendRequestRepository,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: 'CACHE_MANAGER',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should emit user.blocked event when blocking a user', async () => {
    await service.blockUser('1', '2');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      FRIEND_EVENTS.USER_BLOCKED,
      expect.objectContaining({ blockerId: '1', blockedId: '2' }),
    );
  });

  it('should throw NotFoundException if user not found', async () => {
    mockDataSource.transaction.mockImplementationOnce((cb) =>
      cb({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(service.blockUser('1', '2')).rejects.toThrow(
      NotFoundException,
    );
  });
});
