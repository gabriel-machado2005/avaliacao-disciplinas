import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AcademicModule } from './academic/academic.module';
import { AdministrativeAuditModule } from './audit/administrative-audit.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { QuestionnairesModule } from './questionnaires/questionnaires.module';
import { ImprovementPlansModule } from './improvement-plans/improvement-plans.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),

        autoLoadEntities: true,

        synchronize: false,
        installExtensions: false,
      }),
    }),

    UsersModule,

    AuthModule,

    AcademicModule,

    AdministrativeAuditModule,

    EvaluationsModule,

    QuestionnairesModule,

    ImprovementPlansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
