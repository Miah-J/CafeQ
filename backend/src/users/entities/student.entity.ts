import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('students')
export class Student {
  @PrimaryColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  user: User;

  @Column({ name: 'student_number', unique: true })
  studentNumber: string;
}
