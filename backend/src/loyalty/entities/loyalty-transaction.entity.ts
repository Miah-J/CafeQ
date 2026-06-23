import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('loyalty_transactions')
export class LoyaltyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'loyalty_account_id', type: 'uuid' })
  loyaltyAccountId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'transaction_type', type: 'varchar', length: 50 })
  transactionType: string; // 'EARN', 'REDEEM', 'REFUND_DEDUCT', 'REFUND_RETURN'

  @Column({ name: 'reference_id', type: 'varchar', length: 100, nullable: true })
  referenceId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
