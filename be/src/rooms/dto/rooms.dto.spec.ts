import { validate } from 'class-validator';
import { UpdateRoomDto, SendMessageDto } from './rooms.dto';
import { plainToInstance } from 'class-transformer';

describe('Rooms DTOs', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  describe('UpdateRoomDto', () => {
    it('should fail if avatar_url is not a string', async () => {
      const dto = plainToInstance(UpdateRoomDto, {
        avatar_url: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('avatar_url');
    });
  });

  describe('SendMessageDto', () => {
    it('should fail if type is invalid', async () => {
      const dto = plainToInstance(SendMessageDto, {
        roomId: validUuid,
        content: 'hello',
        type: 'invalid-type',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('type');
    });

    it('should fail if roomId is not a UUID', async () => {
      const dto = plainToInstance(SendMessageDto, {
        roomId: 'invalid-uuid',
        content: 'hello',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('roomId');
    });

    it('should pass if type is valid (text)', async () => {
      const dto = plainToInstance(SendMessageDto, {
        roomId: validUuid,
        content: 'hello',
        type: 'text',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
