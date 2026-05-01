import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WebrtcService } from './webrtc.service';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('WebRTC')
@ApiBearerAuth()
@Controller('webrtc')
@UseGuards(AuthGuard('jwt'))
export class WebrtcController {
  constructor(private webrtcService: WebrtcService) {}

  @Get('ice-servers')
  getIceServers() {
    return this.webrtcService.getIceServers();
  }
}
