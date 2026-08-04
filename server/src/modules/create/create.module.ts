import { Module } from '@nestjs/common';
import { CreateService } from './create.service';
import { CreateController } from './create.controller';

@Module({
  controllers: [CreateController],
  providers: [{ provide: 'CREATE_SERVICE', useClass: CreateService }],
  exports: ['CREATE_SERVICE'],
})
export class CreateModule {}
