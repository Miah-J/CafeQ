import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Menu } from './menu.entity';

@Entity('dishes')
export class Dish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'menu_id' })
  menuId: string;

  @ManyToOne(() => Menu, (menu) => menu.dishes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_id' })
  menu: Menu;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'text', array: true, name: 'dietary_tags', nullable: true })
  dietaryTags: string[];

  @Column({ name: 'prepared_quantity', default: 0 })
  preparedQuantity: number;

  @Column({ name: 'is_sold_out', default: false })
  isSoldOut: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
