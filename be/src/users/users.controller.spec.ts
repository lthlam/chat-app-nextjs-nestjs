import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from './user.entity';
import { instanceToPlain } from 'class-transformer';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = Object.assign(new User(), {
    id: 'uuid',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    avatar_url: null,
    created_at: new Date(),
  });

  const mockUsersService = {
    findById: jest.fn().mockResolvedValue(mockUser),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    getBlockedUsers: jest.fn(),
    getBlockedByUsers: jest.fn(),
    search: jest.fn(),
    findExact: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should not return password in profile', async () => {
    const result = await controller.getProfile('uuid');
    const plain = instanceToPlain(result);
    expect(plain.password).toBeUndefined();
  });
});
