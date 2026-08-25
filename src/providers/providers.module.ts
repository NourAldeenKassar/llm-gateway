import { Global, Module } from '@nestjs/common';
import { ProviderFactory } from './provider.factory';

@Global()
@Module({
  providers: [ProviderFactory],
  exports: [ProviderFactory],
})
export class ProvidersModule {}
