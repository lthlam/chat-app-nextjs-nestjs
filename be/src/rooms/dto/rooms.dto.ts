import {
  IsString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  ArrayNotEmpty,
} from 'class-validator';

import { MessageType } from '../enums/message-type.enum';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  members: string[];
}

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  avatar_url?: string;
}

export class AddMemberDto {
  @IsUUID('4')
  @IsNotEmpty()
  user_id: string;
}

export class JoinRoomDto {
  @IsUUID('4')
  @IsNotEmpty()
  roomId: string;

  @IsUUID('4')
  @IsOptional()
  userId?: string;
}

export class SendMessageDto {
  @IsUUID('4')
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUUID('4')
  replyToMessageId?: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentions?: string[];
}

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class AddReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class ForwardMessageDto {
  @IsUUID('4')
  @IsNotEmpty()
  messageId: string;

  @IsUUID('4')
  @IsNotEmpty()
  targetRoomId: string;
}
