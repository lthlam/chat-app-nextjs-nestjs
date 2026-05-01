import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  q: string;
}
