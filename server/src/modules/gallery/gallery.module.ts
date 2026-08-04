import { Module } from '@nestjs/common';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [GalleryController],
  providers: [{ provide: 'GALLERY_SERVICE', useClass: GalleryService }],
  exports: ['GALLERY_SERVICE'],
})
export class GalleryModule {}