import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SearchUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  q: string;
}
