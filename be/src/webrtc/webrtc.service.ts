import { Injectable } from '@nestjs/common';

@Injectable()
export class WebrtcService {
  getIceServers() {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: process.env.METERED_TURN_USERNAME,
        credential: process.env.METERED_TURN_CREDENTIAL,
      },
    ];
  }
}
