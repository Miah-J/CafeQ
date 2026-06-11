import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Dish } from './dish.entity';

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'publish_date', type: 'date', unique: true })
  publishDate: string;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @OneToMany(() => Dish, (dish) => dish.menu, { cascade: true })
  dishes: Dish[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
