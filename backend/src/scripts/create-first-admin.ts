import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);
    const usersRepository = dataSource.getRepository(User);

    const existingAdmins = await usersRepository.count({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (existingAdmins > 0) {
      console.log(
        'Já existe um administrador cadastrado. Nenhum usuário foi criado.',
      );
      return;
    }

    const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error(
        'Informe BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD.',
      );
    }

    if (password.length < 12) {
      throw new Error('A senha inicial deve possuir pelo menos 12 caracteres.');
    }

    const usersService = app.get(UsersService);

    const admin = await usersService.create({
      name,
      email,
      password,
      role: UserRole.ADMIN,
    });

    console.log(`Administrador inicial criado com sucesso: ${admin.email}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Erro desconhecido.';

  console.error('Falha na configuração inicial:', message);
  process.exitCode = 1;
});
