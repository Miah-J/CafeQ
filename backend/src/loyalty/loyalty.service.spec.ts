import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyAccount } from './entities/loyalty-account.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { BadRequestException } from '@nestjs/common';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let accountRepoMock: any;
  let transactionRepoMock: any;

  beforeEach(async () => {
    accountRepoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    transactionRepoMock = {
      find: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        {
          provide: getRepositoryToken(LoyaltyAccount),
          useValue: accountRepoMock,
        },
        {
          provide: getRepositoryToken(LoyaltyTransaction),
          useValue: transactionRepoMock,
        },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateAccount', () => {
    it('should return existing account if found', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 100, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      const result = await service.getOrCreateAccount('stud-1');
      expect(result).toEqual(mockAccount);
      expect(accountRepoMock.findOne).toHaveBeenCalledWith({ where: { studentId: 'stud-1' } });
    });

    it('should create and return new account if not found', async () => {
      accountRepoMock.findOne.mockResolvedValue(null);
      accountRepoMock.save.mockImplementation((acc: any) => Promise.resolve({ id: 'acc-new', ...acc }));

      const result = await service.getOrCreateAccount('stud-2');
      expect(result.studentId).toBe('stud-2');
      expect(result.pointsBalance).toBe(0);
      expect(result.status).toBe('ACTIVE');
      expect(accountRepoMock.save).toHaveBeenCalled();
    });
  });

  describe('getLoyaltyStatus', () => {
    it('should return correct Bronze tier details', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 100, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      const status = await service.getLoyaltyStatus('stud-1');
      expect(status.tier).toBe('Bronze');
      expect(status.nextTier).toBe('Silver');
      expect(status.progressToNextTier).toBe(0.5); // 100 / 200
      expect(status.isEligible).toBe(true); // >= 50
    });

    it('should return correct Silver tier details', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 250, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      const status = await service.getLoyaltyStatus('stud-1');
      expect(status.tier).toBe('Silver');
      expect(status.nextTier).toBe('Gold');
      expect(status.progressToNextTier).toBe(1/6); // (250-200)/300
    });

    it('should return correct Gold tier details', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 600, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      const status = await service.getLoyaltyStatus('stud-1');
      expect(status.tier).toBe('Gold');
      expect(status.nextTier).toBe('N/A');
      expect(status.progressToNextTier).toBe(1.0);
    });
  });

  describe('checkRedemptionEligibility', () => {
    it('should throw BadRequestException if account status is FROZEN', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 100, status: 'FROZEN' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      await expect(
        service.checkRedemptionEligibility('stud-1', 50, 200)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if balance is insufficient', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 30, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      await expect(
        service.checkRedemptionEligibility('stud-1', 50, 200)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if points to redeem is less than 50', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 100, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      await expect(
        service.checkRedemptionEligibility('stud-1', 20, 200)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if redemption exceeds 30% of order total', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 100, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);

      // Order total is 200, max discount is 30% = 60 points. Trying to redeem 70.
      await expect(
        service.checkRedemptionEligibility('stud-1', 70, 200)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if calendar day redemption count is >= 3', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 200, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);
      transactionRepoMock.count.mockResolvedValue(3); // Already 3 redemptions today

      await expect(
        service.checkRedemptionEligibility('stud-1', 50, 200)
      ).rejects.toThrow(BadRequestException);
    });

    it('should return true if all checks pass', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 200, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);
      transactionRepoMock.count.mockResolvedValue(1); // 1 redemption today

      const result = await service.checkRedemptionEligibility('stud-1', 50, 200);
      expect(result).toBe(true);
    });
  });

  describe('deductPointsForRefund', () => {
    it('should freeze account if balance falls below zero after refund deduction', async () => {
      const mockAccount = { id: 'acc-1', studentId: 'stud-1', pointsBalance: 20, status: 'ACTIVE' };
      accountRepoMock.findOne.mockResolvedValue(mockAccount);
      accountRepoMock.save.mockResolvedValue(mockAccount);
      transactionRepoMock.save.mockResolvedValue({});

      // Create a mock Entity Manager for the transaction run
      const mockEntityManager: any = {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === LoyaltyAccount) return accountRepoMock;
          if (entity === LoyaltyTransaction) return transactionRepoMock;
        }),
        save: jest.fn().mockImplementation((entity, obj) => Promise.resolve(obj)),
      };

      await service.deductPointsForRefund('stud-1', 30, 'order-1', mockEntityManager);
      
      // Verified that account saved with negative balance and frozen state
      expect(mockEntityManager.save).toHaveBeenCalledWith(LoyaltyAccount, expect.objectContaining({
        pointsBalance: -10,
        status: 'FROZEN',
      }));
    });
  });
});
