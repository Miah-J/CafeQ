import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

describe('UsersService', () => {
  let service: UsersService;
  let dataSourceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          query: jest.fn(),
        },
      }),
      query: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'pgcrypto.key') return 'test_key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const runner = dataSourceMock.createQueryRunner();
      runner.manager.query
        .mockResolvedValueOnce([]) // Check email (none existing)
        .mockResolvedValueOnce([{ id: 'mocked-uuid' }]) // Insert user returns id
        .mockResolvedValueOnce([]); // Check student number

      const result = await service.createUser({
        email: 'test@student.com',
        passwordHash: 'hashed_pw',
        role: 'Student',
        fullName: 'John Doe',
        studentNumber: '123456',
      });

      expect(result.id).toBe('mocked-uuid');
      expect(result.email).toBe('test@student.com');
      expect(runner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      const runner = dataSourceMock.createQueryRunner();
      runner.manager.query.mockResolvedValueOnce([{ id: 'existing-id' }]); // Check email returns match

      await expect(
        service.createUser({
          email: 'test@student.com',
          passwordHash: 'hashed_pw',
          role: 'Student',
          fullName: 'John Doe',
          studentNumber: '123456',
        }),
      ).rejects.toThrow();

      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return user with decrypted data', async () => {
      dataSourceMock.query.mockResolvedValueOnce([
        {
          id: 'user-id',
          email: 'test@student.com',
          role: 'Student',
          fullName: 'John Doe',
          phoneNumber: '0712345678',
          studentNumber: '123456',
        },
      ]);

      const result = await service.findByEmail('test@student.com');
      expect(result).toBeDefined();
      expect(result.fullName).toBe('John Doe');
    });
  });
});
