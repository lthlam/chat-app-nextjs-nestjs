import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { UsersService } from '../users/users.service';
import { RoomsService } from './rooms.service';
import { JwtService } from '@nestjs/jwt';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('MessagesGateway', () => {
  const mockMessagesService = {};
  const mockUsersService = {};
  const mockRoomsService = {};
  const mockJwtService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: RoomsService, useValue: mockRoomsService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
  });

  it('should have WsJwtGuard applied', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MessagesGateway);
    expect(guards).toBeDefined();
    expect(guards.some((g: any) => g.name === 'WsJwtGuard')).toBe(true);
  });
});
