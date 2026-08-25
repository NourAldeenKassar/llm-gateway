import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { RouterModule } from '../router/router.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RouterModule, AuthModule],
  controllers: [GatewayController],
})
export class GatewayModule {}
