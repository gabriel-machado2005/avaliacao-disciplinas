import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const usersRepositoryMock = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    usersRepositoryMock.find.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('deve criar o serviço corretamente', () => {
    expect(service).toBeDefined();
  });

  it('deve consultar apenas estudantes ativos', async () => {
    const students = [
      {
        id: 'student-id-1',
        name: 'Aluno Exemplo',
      },
    ];

    usersRepositoryMock.find.mockResolvedValue(students);

    const result = await service.findStudents();

    expect(result).toEqual(students);

    expect(usersRepositoryMock.find).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
      },
      where: {
        role: UserRole.STUDENT,
        active: true,
      },
      order: {
        name: 'ASC',
      },
    });
  });

  it('deve consultar apenas professores ativos', async () => {
    const professors = [
      {
        id: 'professor-id-1',
        name: 'Professor Exemplo',
      },
    ];

    usersRepositoryMock.find.mockResolvedValue(professors);

    const result = await service.findProfessors();

    expect(result).toEqual(professors);

    expect(usersRepositoryMock.find).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
      },
      where: {
        role: UserRole.PROFESSOR,
        active: true,
      },
      order: {
        name: 'ASC',
      },
    });
  });
});
