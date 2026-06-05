import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { StaffAuthController } from './staff/staff-auth.controller';
import { StaffProfileController } from './staff/staff-profile.controller';
import { StaffAuthService } from './staff/staff-auth.service';
import { StaffJwtService } from './staff/staff-jwt.service';
import { StaffAuthGuard } from './staff/staff-auth.guard';
import { TenantController } from './tenant/tenant.controller';
import { TenantService } from './tenant/tenant.service';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { MerchantsController } from './merchants/merchants.controller';
import { MerchantsService } from './merchants/merchants.service';
import { TradingController } from './trading/trading.controller';
import { TradingService } from './trading/trading.service';
import { StaffBetsController } from './bets/staff-bets.controller';
import { StaffBetsService } from './bets/staff-bets.service';
import { StaffSettlementController } from './settlement/staff-settlement.controller';
import { StaffSettlementService } from './settlement/staff-settlement.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { ComplianceController } from './compliance/compliance.controller';
import { ComplianceService } from './compliance/compliance.service';

@Module({
  imports: [WalletModule],
  controllers: [
    StaffAuthController,
    StaffProfileController,
    TenantController,
    ProductController,
    MerchantsController,
    TradingController,
    StaffBetsController,
    StaffSettlementController,
    AnalyticsController,
    ComplianceController,
  ],
  providers: [
    StaffAuthService,
    StaffJwtService,
    StaffAuthGuard,
    TenantService,
    ProductService,
    MerchantsService,
    TradingService,
    StaffBetsService,
    StaffSettlementService,
    AnalyticsService,
    ComplianceService,
  ],
})
export class BackofficeModule {}
