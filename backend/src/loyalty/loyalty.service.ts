import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Between } from 'typeorm';
import { LoyaltyAccount } from './entities/loyalty-account.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyAccount)
    private readonly loyaltyAccountRepository: Repository<LoyaltyAccount>,
    @InjectRepository(LoyaltyTransaction)
    private readonly loyaltyTransactionRepository: Repository<LoyaltyTransaction>,
  ) {}

  async getOrCreateAccount(studentId: string, entityManager?: EntityManager): Promise<LoyaltyAccount> {
    const repo = entityManager ? entityManager.getRepository(LoyaltyAccount) : this.loyaltyAccountRepository;
    let account = await repo.findOne({ where: { studentId } });
    if (!account) {
      account = new LoyaltyAccount();
      account.studentId = studentId;
      account.pointsBalance = 0;
      account.status = 'ACTIVE';
      account = await repo.save(account);
    }
    return account;
  }

  async getLoyaltyStatus(studentId: string) {
    const account = await this.getOrCreateAccount(studentId);
    
    // Tiers mapping
    let tier = 'Bronze';
    let nextTier = 'Silver';
    let threshold = 200;
    
    if (account.pointsBalance >= 500) {
      tier = 'Gold';
      nextTier = 'N/A';
      threshold = 500;
    } else if (account.pointsBalance >= 200) {
      tier = 'Silver';
      nextTier = 'Gold';
      threshold = 500;
    }

    let progressToNextTier = 1.0;
    if (tier === 'Bronze') {
      progressToNextTier = Math.max(0, account.pointsBalance / 200);
    } else if (tier === 'Silver') {
      const balanceInTier = account.pointsBalance - 200;
      progressToNextTier = Math.max(0, balanceInTier / 300);
    }

    return {
      pointsBalance: account.pointsBalance,
      status: account.status,
      tier,
      nextTier,
      progressToNextTier: Math.min(1.0, progressToNextTier),
      redemptionThreshold: 50,
      isEligible: account.pointsBalance >= 50 && account.status === 'ACTIVE',
    };
  }

  async getLoyaltyHistory(studentId: string): Promise<LoyaltyTransaction[]> {
    const account = await this.getOrCreateAccount(studentId);
    return this.loyaltyTransactionRepository.find({
      where: { loyaltyAccountId: account.id },
      order: { createdAt: 'DESC' },
    });
  }

  async getAdminStats() {
    const totalIssuedRes = await this.loyaltyTransactionRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'total')
      .where("tx.transaction_type IN ('EARN', 'REFUND_RETURN')")
      .getRawOne<{ total: string | null }>();

    const totalRedeemedRes = await this.loyaltyTransactionRepository
      .createQueryBuilder('tx')
      .select('SUM(ABS(tx.amount))', 'total')
      .where("tx.transaction_type = 'REDEEM'")
      .getRawOne<{ total: string | null }>();

    const activeCount = await this.loyaltyAccountRepository.count({ where: { status: 'ACTIVE' } });
    const frozenCount = await this.loyaltyAccountRepository.count({ where: { status: 'FROZEN' } });

    // Eligible accounts have balance >= 50 and status is ACTIVE
    const eligibleAccounts = await this.loyaltyAccountRepository
      .createQueryBuilder('acc')
      .where('acc.points_balance >= 50')
      .andWhere("acc.status = 'ACTIVE'")
      .getCount();

    return {
      totalPointsIssued: Number(totalIssuedRes?.total || 0),
      totalPointsRedeemed: Number(totalRedeemedRes?.total || 0),
      activeAccountsCount: activeCount,
      frozenAccountsCount: frozenCount,
      eligibleAccountsCount: eligibleAccounts,
    };
  }

  async checkRedemptionEligibility(
    studentId: string,
    pointsToRedeem: number,
    orderTotal: number,
    entityManager?: EntityManager,
  ): Promise<boolean> {
    if (pointsToRedeem <= 0) return true;

    const account = await this.getOrCreateAccount(studentId, entityManager);

    if (account.status === 'FROZEN') {
      throw new BadRequestException('Your loyalty account is frozen due to a negative balance.');
    }

    if (account.pointsBalance < pointsToRedeem) {
      throw new BadRequestException(`Insufficient loyalty balance. You have ${account.pointsBalance} points.`);
    }

    if (pointsToRedeem < 50) {
      throw new BadRequestException('Minimum 50 points balance required to redeem.');
    }

    // Max 30% of order total per redemption
    const maxRedeemableAmount = orderTotal * 0.3;
    if (pointsToRedeem > maxRedeemableAmount) {
      throw new BadRequestException(
        `Loyalty redemption cannot exceed 30% of the order total (Max: ${Math.floor(maxRedeemableAmount)} points).`,
      );
    }

    // Max 3 redemptions per calendar day per account
    const txRepo = entityManager ? entityManager.getRepository(LoyaltyTransaction) : this.loyaltyTransactionRepository;
    
    // Nairobi timezone offset is UTC+3
    const now = new Date();
    const nairobiTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const startOfDay = new Date(Date.UTC(
      nairobiTime.getUTCFullYear(),
      nairobiTime.getUTCMonth(),
      nairobiTime.getUTCDate(),
      -3, // Nairobi midnight is 21:00 UTC of previous day, so -3 offset aligns UTC day start
      0, 0, 0
    ));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayRedemptionsCount = await txRepo.count({
      where: {
        loyaltyAccountId: account.id,
        transactionType: 'REDEEM',
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    if (todayRedemptionsCount >= 3) {
      throw new BadRequestException('Daily limit exceeded. Maximum 3 redemptions allowed per calendar day.');
    }

    return true;
  }

  async redeemPoints(
    studentId: string,
    pointsToRedeem: number,
    orderId: string,
    entityManager: EntityManager,
  ): Promise<void> {
    if (pointsToRedeem <= 0) return;

    const account = await this.getOrCreateAccount(studentId, entityManager);
    
    account.pointsBalance -= pointsToRedeem;
    if (account.pointsBalance < 0) {
      account.status = 'FROZEN';
    }
    await entityManager.save(LoyaltyAccount, account);

    const tx = new LoyaltyTransaction();
    tx.loyaltyAccountId = account.id;
    tx.amount = -pointsToRedeem;
    tx.transactionType = 'REDEEM';
    tx.referenceId = orderId;
    await entityManager.save(LoyaltyTransaction, tx);
  }

  async restorePoints(
    studentId: string,
    pointsToRestore: number,
    orderId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    if (pointsToRestore <= 0) return;

    const account = await this.getOrCreateAccount(studentId, entityManager);
    
    account.pointsBalance += pointsToRestore;
    if (account.pointsBalance >= 0) {
      account.status = 'ACTIVE';
    }
    if (entityManager) {
      await entityManager.save(LoyaltyAccount, account);
    } else {
      await this.loyaltyAccountRepository.save(account);
    }

    const tx = new LoyaltyTransaction();
    tx.loyaltyAccountId = account.id;
    tx.amount = pointsToRestore;
    tx.transactionType = 'REFUND_RETURN';
    tx.referenceId = orderId;
    
    if (entityManager) {
      await entityManager.save(LoyaltyTransaction, tx);
    } else {
      await this.loyaltyTransactionRepository.save(tx);
    }
  }

  async creditPointsForCollection(
    studentId: string,
    pointsToCredit: number,
    orderId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    if (pointsToCredit <= 0) return;

    const account = await this.getOrCreateAccount(studentId, entityManager);
    
    account.pointsBalance += pointsToCredit;
    if (account.pointsBalance >= 0) {
      account.status = 'ACTIVE';
    }
    if (entityManager) {
      await entityManager.save(LoyaltyAccount, account);
    } else {
      await this.loyaltyAccountRepository.save(account);
    }

    const tx = new LoyaltyTransaction();
    tx.loyaltyAccountId = account.id;
    tx.amount = pointsToCredit;
    tx.transactionType = 'EARN';
    tx.referenceId = orderId;
    
    if (entityManager) {
      await entityManager.save(LoyaltyTransaction, tx);
    } else {
      await this.loyaltyTransactionRepository.save(tx);
    }
  }

  async deductPointsForRefund(
    studentId: string,
    pointsToDeduct: number,
    orderId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    if (pointsToDeduct <= 0) return;

    const account = await this.getOrCreateAccount(studentId, entityManager);
    
    account.pointsBalance -= pointsToDeduct;
    if (account.pointsBalance < 0) {
      account.status = 'FROZEN';
    }
    if (entityManager) {
      await entityManager.save(LoyaltyAccount, account);
    } else {
      await this.loyaltyAccountRepository.save(account);
    }

    const tx = new LoyaltyTransaction();
    tx.loyaltyAccountId = account.id;
    tx.amount = -pointsToDeduct;
    tx.transactionType = 'REFUND_DEDUCT';
    tx.referenceId = orderId;
    
    if (entityManager) {
      await entityManager.save(LoyaltyTransaction, tx);
    } else {
      await this.loyaltyTransactionRepository.save(tx);
    }
  }
}
