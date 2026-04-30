import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendRequest } from './friend-request.entity';
import { User } from '../users/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../users/users.service';

import { CACHE_MANAGER } from '@nestjs/cache-manager';

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
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: getRepositoryToken(FriendRequest),
          useValue: mockFriendRequestRepository,
        },
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    friendRequestRepo = module.get(getRepositoryToken(FriendRequest));
  });

  it('should call database only once for two calls (After Caching)', async () => {
    mockCacheManager.get.mockResolvedValueOnce(null).mockResolvedValueOnce([]);

    await service.getFriendList('user-1');
    await service.getFriendList('user-1');

    expect(friendRequestRepo.find).toHaveBeenCalledTimes(1);
  });
});
