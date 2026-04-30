import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TypeOrmConfigService } from './typeorm.config';

describe('TypeOrmConfigService', () => {
  let service: TypeOrmConfigService;

  const defaultConfig = (key: string): any => {
    switch (key) {
      case 'DB_HOST':
        return 'localhost';
      case 'DB_PORT':
        return 5432;
      case 'DB_USER':
        return 'testuser';
      case 'DB_PASSWORD':
        return 'testpass';
      case 'DB_NAME':
        return 'testdb';
      case 'NODE_ENV':
        return 'development';
      case 'DB_SSL':
        return 'false';
      default:
        return null;
    }
  };

  const mockConfigService = {
    get: jest.fn(defaultConfig),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypeOrmConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TypeOrmConfigService>(TypeOrmConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return correct typeorm options', () => {
    mockConfigService.get.mockImplementation(defaultConfig);
    const options = service.createTypeOrmOptions();

    expect(options).toEqual(
      expect.objectContaining({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'testuser',
        password: 'testpass',
        database: 'testdb',
        synchronize: true,
        ssl: false,
      }),
    );
  });

  it('should enable ssl when DB_SSL is true', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'DB_SSL') return 'true';
      return defaultConfig(key);
    });

    const options = service.createTypeOrmOptions() as any;
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('should disable synchronize in production', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return defaultConfig(key);
    });

    const options = service.createTypeOrmOptions() as any;
    expect(options.synchronize).toBe(false);
  });
});
