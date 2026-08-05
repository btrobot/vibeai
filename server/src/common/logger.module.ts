import { Module, Global } from '@nestjs/common';
import { AppLoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    AppLoggerService,
    {
      provide: 'APP_LOGGER',
      useExisting: AppLoggerService,
    },
  ],
  exports: [AppLoggerService, 'APP_LOGGER'],
})
export class LoggerModule {}
