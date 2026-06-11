import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url =
      this.configService.get<string>('redis.url') || 'redis://localhost:6379';
    this.client = new Redis(url);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }
}
