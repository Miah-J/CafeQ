import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('cashiers')
export class Cashier {
  @PrimaryColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  user: User;

  @Column({ name: 'station_number', nullable: true })
  stationNumber: string;
}
