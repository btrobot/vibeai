import { Module } from '@nestjs/common';
import { CreateService } from './create.service';
import { CreateController } from './create.controller';
import { StorageModule } from '../storage/storage.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [StorageModule, ProjectModule],
  controllers: [CreateController],
  providers: [{ provide: 'CREATE_SERVICE', useClass: CreateService }],
  exports: ['CREATE_SERVICE'],
})
export class CreateModule {}
