import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { RouterModule } from '../router/router.module';

@Module({
  imports: [AuthModule, RouterModule],
  controllers: [AdminController],
})
export class AdminModule {}
