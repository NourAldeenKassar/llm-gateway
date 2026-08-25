import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { RouterModule } from './router/router.module';
import { GatewayModule } from './gateway/gateway.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveStaticOptions: {
        index: ['index.html'],
      },
    }),
    PrismaModule,
    ProvidersModule,
    RouterModule,
    GatewayModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
