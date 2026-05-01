import {
  IsString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { MessageType } from '../enums/message-type.enum';

export class CreateRoomDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  members: string[];
}

export class UpdateRoomDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar_url?: string;
}

export class AddMemberDto {
  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  user_id: string;
}

export class JoinRoomDto {
  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  roomId: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  userId?: string;
}

export class SendMessageDto {
  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  roomId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  replyToMessageId?: string;

  @ApiPropertyOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  mentions?: string[];
}

export class UpdateMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class AddReactionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class ForwardMessageDto {
  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  messageId: string;

  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  targetRoomId: string;
}
