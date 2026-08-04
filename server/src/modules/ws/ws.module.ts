import { Global, Module } from '@nestjs/common';
import { WsService } from './ws.service';

@Global()
@Module({
  providers: [{ provide: 'WS_SERVICE', useClass: WsService }],
  exports: ['WS_SERVICE'],
})
export class WsModule {}