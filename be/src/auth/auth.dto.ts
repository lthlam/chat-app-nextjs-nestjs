import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+$/, {
    message: 'Username must contain only lowercase letters and numbers',
  })
  username: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class AuthResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  user: {
    id: string;
    username: string;
    email: string;
    avatar_url?: string;
    created_at: Date;
  };
}
