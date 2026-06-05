import { Module } from '@nestjs/common';
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

@Module({
  controllers: [
    StaffAuthController,
    StaffProfileController,
    TenantController,
    ProductController,
    MerchantsController,
  ],
  providers: [
    StaffAuthService,
    StaffJwtService,
    StaffAuthGuard,
    TenantService,
    ProductService,
    MerchantsService,
  ],
})
export class BackofficeModule {}
