import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('loyalty_accounts')
export class LoyaltyAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid', unique: true })
  studentId: string;

  @Column({ name: 'points_balance', type: 'integer', default: 0 })
  pointsBalance: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string; // 'ACTIVE', 'FROZEN'

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
