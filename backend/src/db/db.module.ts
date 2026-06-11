import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Student } from '../users/entities/student.entity';
import { Administrator } from '../users/entities/administrator.entity';
import { Cashier } from '../users/entities/cashier.entity';
import { RedisService } from './redis.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('database.url'),
        entities: [User, Student, Administrator, Cashier],
        autoLoadEntities: true,
        synchronize: false, // Manually loaded schema.sql
        logging: process.env.NODE_ENV !== 'production',
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class DbModule {}
