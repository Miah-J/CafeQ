import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MenusModule } from './menus/menus.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { CollectionModule } from './collection/collection.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { RefundModule } from './refund/refund.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { AnalyticsModule } from './analytics/analytics.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    DbModule,
    UsersModule,
    AuthModule,
    MenusModule,
    OrdersModule,
    PaymentsModule,
    CollectionModule,
    KitchenModule,
    RefundModule,
    LoyaltyModule,
    ForecastingModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
