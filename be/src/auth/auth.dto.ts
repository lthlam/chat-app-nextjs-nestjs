export class RegisterDto {
  username: string;
  email: string;
  password: string;
}

export class LoginDto {
  email: string;
  password: string;
}

export class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatar_url?: string;
    created_at: Date;
  };
}
