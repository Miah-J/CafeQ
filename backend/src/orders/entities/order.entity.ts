import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ReferenceNumber } from './reference-number.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'decimal', name: 'total_amount', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ default: 'PENDING' })
  status: string; // PENDING, CONFIRMED, PARTIALLY_COLLECTED, COLLECTED, REFUNDED

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToOne(() => ReferenceNumber, (ref) => ref.order)
  referenceNumber: ReferenceNumber;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
