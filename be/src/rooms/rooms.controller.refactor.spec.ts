import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

describe('RoomsController (Post-Refactor Test)', () => {
  let controller: RoomsController;
  let roomsService: RoomsService;

  const mockRoomsService = {
    createRoom: jest.fn(),
    addMember: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [{ provide: RoomsService, useValue: mockRoomsService }],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
    roomsService = module.get<RoomsService>(RoomsService);
  });

  it('should call RoomsService.createRoom when creating a room', async () => {
    const req = { user: { id: 'user-owner' } };
    const createDto = { name: 'Test Room', members: ['user-1'] };

    mockRoomsService.createRoom.mockResolvedValue({ id: 'room-1' });

    await controller.createRoom(req as any, createDto as any);

    expect(roomsService.createRoom).toHaveBeenCalledWith(
      'Test Room',
      'user-owner',
      ['user-1'],
    );
  });

  it('should call RoomsService.addMember when adding a member', async () => {
    const roomId = 'room-1';
    const userId = 'user-2';

    mockRoomsService.addMember.mockResolvedValue({ id: roomId });

    await controller.addMember(roomId, { user_id: userId });

    expect(roomsService.addMember).toHaveBeenCalledWith(roomId, userId);
  });
});
