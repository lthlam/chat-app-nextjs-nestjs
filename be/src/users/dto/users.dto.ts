import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+$/, {
    message: 'Username must contain only lowercase letters and numbers',
  })
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  avatar_url?: string;
}
