import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendRequest } from './friend-request.entity';
import { User } from '../users/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../users/users.service';

describe('FriendsService (Phase 4 - Caching)', () => {
  let service: FriendsService;
  let friendRequestRepo: any;

  const mockFriendRequestRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockUsersRepository = {};
  const mockEventEmitter = { emit: jest.fn() };
  const mockUsersService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: getRepositoryToken(FriendRequest), useValue: mockFriendRequestRepository },
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    friendRequestRepo = module.get(getRepositoryToken(FriendRequest));
  });

  it('should call database twice for two calls (Before Caching)', async () => {
    await service.getFriendList('user-1');
    await service.getFriendList('user-1');
    
    expect(friendRequestRepo.find).toHaveBeenCalledTimes(2);
  });
});
