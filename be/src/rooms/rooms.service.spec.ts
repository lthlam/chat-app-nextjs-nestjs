import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Room } from './room.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { RoomClearedHistory } from './entities/room-cleared-history.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RoomsService', () => {
  let service: RoomsService;
  let roomsRepository: any;
  let usersRepository: any;

  const mockRepository = () => ({
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    findBy: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getRawMany: jest.fn(),
      getCount: jest.fn(),
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: getRepositoryToken(Room), useFactory: mockRepository },
        { provide: getRepositoryToken(Message), useFactory: mockRepository },
        { provide: getRepositoryToken(User), useFactory: mockRepository },
        {
          provide: getRepositoryToken(RoomClearedHistory),
          useFactory: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    roomsRepository = module.get(getRepositoryToken(Room));
    usersRepository = module.get(getRepositoryToken(User));
  });

  describe('updateRoom', () => {
    it('should throw NotFoundException if room not found', async () => {
      roomsRepository.findOne.mockResolvedValue(null);
      await expect(service.updateRoom('1', 'user-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      roomsRepository.findOne.mockResolvedValue({
        id: '1',
        owner: { id: 'other-user' },
      });
      await expect(service.updateRoom('1', 'user-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('clearRoomHistory', () => {
    it('should throw NotFoundException if room not found', async () => {
      roomsRepository.findOneBy.mockResolvedValue(null);
      await expect(service.clearRoomHistory('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      roomsRepository.findOneBy.mockResolvedValue({ id: '1' });
      usersRepository.findOneBy.mockResolvedValue(null);
      await expect(service.clearRoomHistory('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
