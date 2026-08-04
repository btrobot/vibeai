import { Module } from '@nestjs/common';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  controllers: [GalleryController],
  providers: [{ provide: 'GALLERY_SERVICE', useClass: GalleryService }],
  exports: ['GALLERY_SERVICE'],
})
export class GalleryModule {}