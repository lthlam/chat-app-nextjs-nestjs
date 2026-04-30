import { validate } from './env.validation';

describe('env.validation', () => {
  it('should throw error if config is invalid', () => {
    const config = {
      NODE_ENV: 'invalid_env',
      PORT: 'not_a_number',
    };
    expect(() => validate(config)).toThrow();
  });

  it('should return validated config if valid', () => {
    const config = {
      NODE_ENV: 'development',
      PORT: 3001,
      JWT_SECRET: 'DUMMY_SECRET_FOR_TESTING_ONLY',
      FRONTEND_URL: 'http://localhost:3000',
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USER: 'postgres',
      DB_PASSWORD: 'DUMMY_PASSWORD_FOR_TESTING',
      DB_NAME: 'chat_app',
    };
    const validated = validate(config);
    expect(validated.PORT).toBe(3001);
    expect(validated.NODE_ENV).toBe('development');
  });
});
