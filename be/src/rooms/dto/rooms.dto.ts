import {
  IsString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsUrl,
} from 'class-validator';

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

  @IsUrl()
  @IsOptional()
  avatar_url?: string;
}

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}
