import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';
import { getTransportConfig } from './transport-config';

async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const transport = getTransportConfig(process.env);
  const app = await NestFactory.create(AppModule, {
    httpsOptions: transport.httpsOptions,
  });

  app.enableCors(transport.cors);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupOpenApi(app);

  await app.listen(transport.port, transport.host);
}

void bootstrap();
