import { Global, Module } from '@nestjs/common';
import { WsService } from './ws.service';

@Global()
@Module({
  providers: [WsService],
  exports: [WsService],
})
export class WsModule {}