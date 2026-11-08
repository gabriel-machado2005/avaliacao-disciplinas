import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    create: jest.fn(),
    findProfessors: jest.fn(),
    findStudents: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
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

    controller = module.get<UsersController>(UsersController);
  });

  it('deve criar o controller corretamente', () => {
    expect(controller).toBeDefined();
  });

  it('deve retornar a lista de professores', async () => {
    const professors = [
      {
        id: 'professor-id-1',
        name: 'Professor Exemplo',
      },
    ];

    usersServiceMock.findProfessors.mockResolvedValue(professors);

    const result = await controller.findProfessors();

    expect(result).toEqual(professors);

    expect(usersServiceMock.findProfessors).toHaveBeenCalledTimes(1);
  });

  it('deve retornar a lista de estudantes', async () => {
    const students = [
      {
        id: 'student-id-1',
        name: 'Aluno Exemplo',
      },
    ];

    usersServiceMock.findStudents.mockResolvedValue(students);

    const result = await controller.findStudents();

    expect(result).toEqual(students);

    expect(usersServiceMock.findStudents).toHaveBeenCalledTimes(1);
  });
});
