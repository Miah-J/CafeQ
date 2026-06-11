import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Student } from './entities/student.entity';
import { Administrator } from './entities/administrator.entity';
import { Cashier } from './entities/cashier.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Student, Administrator, Cashier])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
