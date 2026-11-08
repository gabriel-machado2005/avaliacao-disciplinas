import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('deve criar o controller corretamente', () => {
    expect(controller).toBeDefined();
  });

  it('deve encaminhar as credenciais para o AuthService', async () => {
    const loginDto = {
      email: 'aluno.teste@exemplo.com',
      password: 'SenhaCorreta123!',
    };

    const response = {
      accessToken: 'token-de-teste',
      user: {
        id: 'student-id-1',
        name: 'Aluno Teste',
        email: loginDto.email,
        role: 'STUDENT',
      },
    };

    authServiceMock.login.mockResolvedValue(response);

    const result = await controller.login(loginDto);

    expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
    expect(authServiceMock.login).toHaveBeenCalledTimes(1);
    expect(result).toEqual(response);
  });

  it('deve propagar o erro quando as credenciais forem inválidas', async () => {
    const loginDto = {
      email: 'aluno.teste@exemplo.com',
      password: 'SenhaIncorreta!',
    };

    authServiceMock.login.mockRejectedValue(
      new UnauthorizedException('E-mail ou senha inválidos.'),
    );

    await expect(controller.login(loginDto)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
  });
});
