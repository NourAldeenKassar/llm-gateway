import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { AdminGuard } from './admin.guard';

@Module({
  providers: [ApiKeyGuard, AdminGuard],
  exports: [ApiKeyGuard, AdminGuard],
})
export class AuthModule {}
