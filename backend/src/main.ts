import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentacao da API disponivel apenas em desenvolvimento.
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Plataforma de Avaliacao de Disciplinas')
      .setDescription('API do projeto de estagio UniXS/UNISINOS.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
