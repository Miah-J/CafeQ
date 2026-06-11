import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('administrators')
export class Administrator {
  @PrimaryColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  user: User;

  @Column({ nullable: true })
  department: string;
}
