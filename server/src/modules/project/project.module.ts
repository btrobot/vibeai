import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';

@Module({
  controllers: [ProjectController],
  providers: [{ provide: 'PROJECT_SERVICE', useClass: ProjectService }],
  exports: ['PROJECT_SERVICE'],
})
export class ProjectModule {}