import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupOpenApi(app: INestApplication) {
  if (process.env.NODE_ENV === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('Plataforma de Avaliação de Disciplinas')
    .setDescription(
      'API do projeto de estágio UniXS/UNISINOS. Obtenha o token em POST /auth/login e use-o nas operações marcadas com Bearer. ' +
        'Erros HTTP incluem statusCode e message. Erros de validação podem retornar uma lista de mensagens.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
