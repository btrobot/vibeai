import { Module, Provider, Logger } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';
import { DrizzleModule } from '../../common/drizzle.module';

const logger = new Logger('StorageModule');

const storageProviderFactory: Provider = {
  provide: 'STORAGE_PROVIDER',
  useFactory: () => {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    if (providerType === 's3') {
      logger.log('Using S3 storage provider');
      return new S3StorageProvider();
    }
    logger.log('Using Local storage provider');
    return new LocalStorageProvider();
  },
};

@Module({
  imports: [DrizzleModule],
  controllers: [StorageController],
  providers: [{ provide: 'STORAGE_SERVICE', useClass: StorageService }, storageProviderFactory],
  exports: ['STORAGE_SERVICE'],
})
export class StorageModule {}