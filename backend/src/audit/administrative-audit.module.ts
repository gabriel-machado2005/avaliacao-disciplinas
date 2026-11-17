import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrativeAuditEvent } from './administrative-audit.entity';
import { AdministrativeAuditInterceptor } from './administrative-audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AdministrativeAuditEvent])],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AdministrativeAuditInterceptor,
    },
  ],
})
export class AdministrativeAuditModule {}
