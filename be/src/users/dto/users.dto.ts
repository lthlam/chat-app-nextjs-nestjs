import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+$/, {
    message: 'Username must contain only lowercase letters and numbers',
  })
  username?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar_url?: string;
}
