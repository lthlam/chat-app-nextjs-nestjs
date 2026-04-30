import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { BlockedUser } from './blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

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
        findOne: jest.fn().mockResolvedValue({ id: '1' }),
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
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should emit user.blocked event when blocking a user', async () => {
    await service.blockUser('1', '2');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'user.blocked',
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
