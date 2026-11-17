import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const id = '098ea1be-a0d9-47f4-9edc-4877c10ad03a';
  const tokenClaims = {
    sub: id,
    email: 'email-antigo@example.test',
    role: UserRole.ADMIN,
  };
  const activeUser = () => ({
    id,
    email: 'email-atual@example.test',
    active: true,
    role: UserRole.ADMIN,
  });

  let account: ReturnType<typeof activeUser> | null;
  let strategy: JwtStrategy;
  const repository = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string; active: boolean } }) =>
        account && account.id === where.id && account.active === where.active
          ? account
          : null,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    account = activeUser();
    strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'segredo-de-teste-da-estrategia' }),
      new UsersService(repository as unknown as Repository<User>),
    );
  });

  it.each(Object.values(UserRole))(
    'carrega a conta ativa e usa o perfil %s do banco',
    async (role) => {
      account = { ...activeUser(), role };
      await expect(strategy.validate(tokenClaims)).resolves.toEqual({
        userId: id,
        email: 'email-atual@example.test',
        role,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id, active: true },
        select: { id: true, email: true, role: true },
      });
    },
  );

  it('recarrega o perfil ao receber o mesmo token depois de uma alteração', async () => {
    await expect(strategy.validate(tokenClaims)).resolves.toMatchObject({
      role: UserRole.ADMIN,
    });
    account = { ...activeUser(), role: UserRole.STUDENT };

    await expect(strategy.validate(tokenClaims)).resolves.toMatchObject({
      role: UserRole.STUDENT,
    });
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });

  it('rejeita o token depois que a conta fica inativa', async () => {
    await strategy.validate(tokenClaims);
    account = { ...activeUser(), active: false };

    await expect(strategy.validate(tokenClaims)).rejects.toMatchObject({
      status: 401,
    });
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });

  it('rejeita o token depois que a conta é excluída', async () => {
    await strategy.validate(tokenClaims);
    account = null;

    await expect(strategy.validate(tokenClaims)).rejects.toMatchObject({
      status: 401,
    });
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, null, 'inválido', 42])(
    'rejeita o identificador inválido %p antes de consultar o banco',
    async (sub) => {
      await expect(strategy.validate({ sub })).rejects.toMatchObject({
        status: 401,
      });
      expect(repository.findOne).not.toHaveBeenCalled();
    },
  );
});
