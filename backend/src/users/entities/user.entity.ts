import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  role: string; // 'Student', 'Admin', 'Cashier', 'ServingStaff', 'KitchenStaff'

  @Column({ type: 'bytea', name: 'full_name' })
  fullName: string | Buffer;

  @Column({ type: 'bytea', name: 'phone_number', nullable: true })
  phoneNumber: string | Buffer | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
