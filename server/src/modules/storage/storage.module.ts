import { Module, Provider } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';
import { DrizzleModule } from '../../common/drizzle.module';

const storageProviderFactory: Provider = {
  provide: 'STORAGE_PROVIDER',
  useFactory: () => {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    if (providerType === 's3') {
      return new S3StorageProvider();
    }
    return new LocalStorageProvider();
  },
};

@Module({
  imports: [DrizzleModule],
  controllers: [StorageController],
  providers: [StorageService, storageProviderFactory],
  exports: [StorageService],
})
export class StorageModule {}