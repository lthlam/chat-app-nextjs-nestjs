import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { BlockedUser } from './blocked-user.entity';
import { FriendRequest } from '../friends/friend-request.entity';
import { MessagesGateway } from '../rooms/messages.gateway';
import { DataSource } from 'typeorm';

describe('UsersService', () => {
  let service: UsersService;
  let dataSource: DataSource;

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
  const mockMessagesGateway = {
    notifyUserBlocked: jest.fn(),
    notifyUserUnblocked: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn(),
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
        { provide: MessagesGateway, useValue: mockMessagesGateway },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should use a transaction to block a user', async () => {
    mockUsersRepository.findOneBy.mockResolvedValue({ id: '1' });

    await service.blockUser('1', '2');

    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
