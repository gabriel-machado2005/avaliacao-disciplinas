import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let passwordHash: string;

  const email = 'aluno.teste@exemplo.com';
  const password = 'SenhaCorreta123!';

  const usersServiceMock = {
    findByEmailWithPassword: jest.fn(),
  };

  const jwtServiceMock = {
    signAsync: jest.fn(),
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  function createTestUser() {
    return {
      id: 'student-id-1',
      name: 'Aluno Teste',
      email,
      role: UserRole.STUDENT,
      active: true,
      passwordHash,
    };
  }

  it('deve criar o serviço de autenticação corretamente', () => {
    expect(service).toBeDefined();
  });

  it('deve autenticar um usuário com credenciais válidas', async () => {
    const user = createTestUser();

    usersServiceMock.findByEmailWithPassword.mockResolvedValue(user);
    jwtServiceMock.signAsync.mockResolvedValue('token-de-teste');

    const result = await service.login({
      email,
      password,
    });

    expect(usersServiceMock.findByEmailWithPassword).toHaveBeenCalledWith(
      email,
    );

    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    expect(result).toEqual({
      accessToken: 'token-de-teste',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('deve rejeitar um usuário inexistente', async () => {
    usersServiceMock.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({
        email,
        password,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('deve rejeitar um usuário inativo', async () => {
    const user = {
      ...createTestUser(),
      active: false,
    };

    usersServiceMock.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      service.login({
        email,
        password,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('deve rejeitar uma senha incorreta', async () => {
    const user = createTestUser();

    usersServiceMock.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      service.login({
        email,
        password: 'SenhaErrada123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });
});
