import { IsString, IsArray, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  members: string[];
}

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  avatar_url?: string;
}

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  userId?: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  type?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}
