import { Module, Global } from '@nestjs/common';
import { AppLoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: 'APP_LOGGER',
      useClass: AppLoggerService,
    },
  ],
  exports: ['APP_LOGGER', AppLoggerService],
})
export class LoggerModule {}
