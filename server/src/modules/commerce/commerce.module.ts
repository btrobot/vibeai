import { Module } from '@nestjs/common';
import { ProductCategoryService } from './services/product-category.service';
import { ProductService } from './services/product.service';
import { PromoCodeService } from './services/promo-code.service';
import { ProductCategoryController } from './controllers/product-category.controller';
import { ProductController } from './controllers/product.controller';
import { PromoCodeController, PublicPromoCodeController } from './controllers/promo-code.controller';
import { DrizzleModule } from '../../common/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [
    ProductCategoryController,
    ProductController,
    PromoCodeController,
    PublicPromoCodeController,
  ],
  providers: [
    ProductCategoryService,
    ProductService,
    PromoCodeService,
  ],
  exports: [
    ProductCategoryService,
    ProductService,
    PromoCodeService,
  ],
})
export class CommerceModule {}
