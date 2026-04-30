import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ChatGateway } from './chat.gateway';
import { PresenceGateway } from './presence.gateway';
import { RoomEventsGateway } from './room-events.gateway';
import { CallGateway } from './call.gateway';

describe('Split Gateways Guards', () => {
  const gateways = [
    ChatGateway,
    PresenceGateway,
    RoomEventsGateway,
    CallGateway,
  ];

  gateways.forEach((Gateway) => {
    it(`${Gateway.name} should have WsJwtGuard applied`, () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, Gateway);
      expect(guards).toBeDefined();
      expect(guards.some((g: any) => g.name === 'WsJwtGuard')).toBe(true);
    });
  });
});
