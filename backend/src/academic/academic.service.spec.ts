import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { AcademicService } from './academic.service';
import { AcademicTerm } from './entities/academic-term.entity';
import { ClassGroup } from './entities/class-group.entity';
import { Course } from './entities/course.entity';
import { Discipline } from './entities/discipline.entity';
import { QueryFailedError } from 'typeorm';

describe('AcademicService', () => {
  let service: AcademicService;

  const createRepositoryMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  });

  let courseRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let disciplineRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let academicTermRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let classGroupRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let userRepositoryMock: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    courseRepositoryMock = createRepositoryMock();
    disciplineRepositoryMock = createRepositoryMock();
    academicTermRepositoryMock = createRepositoryMock();
    classGroupRepositoryMock = createRepositoryMock();
    userRepositoryMock = createRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicService,
        {
          provide: getRepositoryToken(Course),
          useValue: courseRepositoryMock,
        },
        {
          provide: getRepositoryToken(Discipline),
          useValue: disciplineRepositoryMock,
        },
        {
          provide: getRepositoryToken(AcademicTerm),
          useValue: academicTermRepositoryMock,
        },
        {
          provide: getRepositoryToken(ClassGroup),
          useValue: classGroupRepositoryMock,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<AcademicService>(AcademicService);
  });

  it('deve criar o serviço acadêmico corretamente', () => {
    expect(service).toBeDefined();
  });

  describe('Cursos', () => {
    it('deve cadastrar um curso válido', async () => {
      const dto = {
        code: 'CC',
        name: 'Ciência da Computação',
      };

      const course = {
        id: 'course-id-1',
        ...dto,
      };

      courseRepositoryMock.findOne.mockResolvedValue(null);
      courseRepositoryMock.create.mockReturnValue(course);
      courseRepositoryMock.save.mockResolvedValue(course);

      const result = await service.createCourse(dto);

      expect(courseRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { code: 'CC' },
      });

      expect(courseRepositoryMock.create).toHaveBeenCalledWith(dto);
      expect(courseRepositoryMock.save).toHaveBeenCalledWith(course);

      expect(result).toEqual(course);
    });

    it('deve rejeitar um curso com código duplicado', async () => {
      const dto = {
        code: 'CC',
        name: 'Ciência da Computação',
      };

      courseRepositoryMock.findOne.mockResolvedValue({
        id: 'existing-course-id',
        ...dto,
      });

      await expect(service.createCourse(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(courseRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve consultar os cursos em ordem alfabética', async () => {
      const courses = [
        { id: '1', name: 'Administração' },
        { id: '2', name: 'Ciência da Computação' },
      ];

      courseRepositoryMock.find.mockResolvedValue(courses);

      const result = await service.findCourses();

      expect(result).toEqual(courses);

      expect(courseRepositoryMock.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
    });

    it('deve atualizar o nome de um curso existente', async () => {
      const course = {
        id: 'course-id-1',
        code: 'CC',
        name: 'Ciência da Computação',
      };

      const updatedCourse = {
        ...course,
        name: 'Bacharelado em Ciência da Computação',
      };

      courseRepositoryMock.findOne.mockResolvedValue(course);
      courseRepositoryMock.save.mockResolvedValue(updatedCourse);

      const result = await service.updateCourse(course.id, {
        name: updatedCourse.name,
      });

      expect(courseRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: course.id,
          code: 'CC',
          name: updatedCourse.name,
        }),
      );

      expect(result).toEqual(updatedCourse);
    });

    it('deve permitir alterar o código de um curso', async () => {
      const course = {
        id: 'course-id-1',
        code: 'CC',
        name: 'Ciência da Computação',
      };

      courseRepositoryMock.findOne
        .mockResolvedValueOnce(course)
        .mockResolvedValueOnce(null);

      courseRepositoryMock.save.mockImplementation(async (value) => value);

      const result = await service.updateCourse(course.id, {
        code: 'CCOMP',
      });

      expect(courseRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { code: 'CCOMP' },
      });

      expect(result.code).toBe('CCOMP');
      expect(result.name).toBe('Ciência da Computação');
    });

    it('deve rejeitar um código de curso já utilizado', async () => {
      const course = {
        id: 'course-id-1',
        code: 'CC',
        name: 'Ciência da Computação',
      };

      const otherCourse = {
        id: 'course-id-2',
        code: 'ADM',
        name: 'Administração',
      };

      courseRepositoryMock.findOne
        .mockResolvedValueOnce(course)
        .mockResolvedValueOnce(otherCourse);

      await expect(
        service.updateCourse(course.id, { code: 'ADM' }),
      ).rejects.toThrow(BadRequestException);

      expect(courseRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar a edição de um curso inexistente', async () => {
      courseRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateCourse('invalid-course-id', {
          name: 'Novo nome',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(courseRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma atualização sem campos', async () => {
      courseRepositoryMock.findOne.mockResolvedValue({
        id: 'course-id-1',
        code: 'CC',
        name: 'Ciência da Computação',
      });

      await expect(service.updateCourse('course-id-1', {})).rejects.toThrow(
        BadRequestException,
      );

      expect(courseRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve excluir um curso sem disciplinas vinculadas', async () => {
      const courseId = 'course-id-1';

      courseRepositoryMock.findOne.mockResolvedValue({
        id: courseId,
        code: 'TESTE',
        name: 'Curso de Teste',
      });

      disciplineRepositoryMock.count.mockResolvedValue(0);
      courseRepositoryMock.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCourse(courseId);

      expect(disciplineRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          course: { id: courseId },
        },
      });

      expect(courseRepositoryMock.delete).toHaveBeenCalledWith(courseId);

      expect(result).toEqual({
        message: 'Curso excluído com sucesso.',
      });
    });

    it('deve impedir a exclusão de um curso com disciplinas', async () => {
      const courseId = 'course-id-1';

      courseRepositoryMock.findOne.mockResolvedValue({
        id: courseId,
        code: 'CC',
        name: 'Ciência da Computação',
      });

      disciplineRepositoryMock.count.mockResolvedValue(2);

      await expect(service.deleteCourse(courseId)).rejects.toThrow(
        ConflictException,
      );

      expect(courseRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deve rejeitar a exclusão de um curso inexistente', async () => {
      courseRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.deleteCourse('course-id-inexistente'),
      ).rejects.toThrow(NotFoundException);

      expect(disciplineRepositoryMock.count).not.toHaveBeenCalled();
      expect(courseRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deve tratar exclusão sem registro afetado', async () => {
      const courseId = 'course-id-1';

      courseRepositoryMock.findOne.mockResolvedValue({
        id: courseId,
        code: 'TESTE',
        name: 'Curso de Teste',
      });

      disciplineRepositoryMock.count.mockResolvedValue(0);
      courseRepositoryMock.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteCourse(courseId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve tratar erro de chave estrangeira ao excluir um curso', async () => {
      const courseId = 'course-id-1';

      courseRepositoryMock.findOne.mockResolvedValue({
        id: courseId,
        code: 'TESTE',
        name: 'Curso de Teste',
      });

      disciplineRepositoryMock.count.mockResolvedValue(0);

      const driverError = Object.assign(
        new Error('Violação de chave estrangeira.'),
        {
          code: '23503',
          detail: 'Registro referenciado por uma chave estrangeira.',
        },
      );

      const databaseError = new QueryFailedError(
        'DELETE FROM courses WHERE id = $1',
        [courseId],
        driverError,
      );

      courseRepositoryMock.delete.mockRejectedValue(databaseError);

      await expect(service.deleteCourse(courseId)).rejects.toThrow(
        ConflictException,
      );

      expect(courseRepositoryMock.delete).toHaveBeenCalledWith(courseId);
    });
  });

  describe('Disciplinas', () => {
    it('deve cadastrar uma disciplina em um curso existente', async () => {
      const dto = {
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        courseId: 'course-id-1',
      };

      const course = {
        id: 'course-id-1',
        code: 'CC',
        name: 'Ciência da Computação',
      };

      const discipline = {
        id: 'discipline-id-1',
        code: dto.code,
        name: dto.name,
        course,
      };

      courseRepositoryMock.findOne.mockResolvedValue(course);
      disciplineRepositoryMock.findOne.mockResolvedValue(null);
      disciplineRepositoryMock.create.mockReturnValue(discipline);
      disciplineRepositoryMock.save.mockResolvedValue(discipline);

      const result = await service.createDiscipline(dto);

      expect(courseRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.courseId },
      });

      expect(disciplineRepositoryMock.create).toHaveBeenCalledWith({
        code: dto.code,
        name: dto.name,
        course,
      });

      expect(result).toEqual(discipline);
    });

    it('deve rejeitar disciplina vinculada a curso inexistente', async () => {
      const dto = {
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        courseId: 'invalid-course-id',
      };

      courseRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createDiscipline(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar código de disciplina duplicado', async () => {
      const dto = {
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        courseId: 'course-id-1',
      };

      courseRepositoryMock.findOne.mockResolvedValue({
        id: dto.courseId,
      });

      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: 'existing-discipline-id',
        code: dto.code,
      });

      await expect(service.createDiscipline(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve consultar disciplinas com seus cursos', async () => {
      const disciplines = [
        {
          id: 'discipline-id-1',
          name: 'Engenharia de Software',
          course: {
            id: 'course-id-1',
            name: 'Ciência da Computação',
          },
        },
      ];

      disciplineRepositoryMock.find.mockResolvedValue(disciplines);

      const result = await service.findDisciplines();

      expect(result).toEqual(disciplines);

      expect(disciplineRepositoryMock.find).toHaveBeenCalledWith({
        relations: {
          course: true,
        },
        order: {
          name: 'ASC',
        },
      });
    });
  });

  describe('Semestres', () => {
    it('deve cadastrar um semestre válido', async () => {
      const dto = {
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      const academicTerm = {
        id: 'term-id-1',
        ...dto,
      };

      academicTermRepositoryMock.findOne.mockResolvedValue(null);
      academicTermRepositoryMock.create.mockReturnValue(academicTerm);
      academicTermRepositoryMock.save.mockResolvedValue(academicTerm);

      const result = await service.createAcademicTerm(dto);

      expect(academicTermRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { code: dto.code },
      });

      expect(academicTermRepositoryMock.create).toHaveBeenCalledWith(dto);
      expect(academicTermRepositoryMock.save).toHaveBeenCalledWith(
        academicTerm,
      );

      expect(result).toEqual(academicTerm);
    });

    it('deve rejeitar um semestre com data final anterior à inicial', async () => {
      const dto = {
        code: '2027/1',
        startDate: '2027-07-31',
        endDate: '2027-03-01',
      };

      await expect(service.createAcademicTerm(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um semestre com datas iguais', async () => {
      const dto = {
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-03-01',
      };

      await expect(service.createAcademicTerm(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um código de semestre duplicado', async () => {
      const dto = {
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      academicTermRepositoryMock.findOne.mockResolvedValue({
        id: 'existing-term-id',
        code: dto.code,
      });

      await expect(service.createAcademicTerm(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve consultar os semestres por data inicial decrescente', async () => {
      const terms = [
        {
          id: 'term-id-2',
          code: '2027/2',
          startDate: '2027-08-01',
        },
        {
          id: 'term-id-1',
          code: '2027/1',
          startDate: '2027-03-01',
        },
      ];

      academicTermRepositoryMock.find.mockResolvedValue(terms);

      const result = await service.findAcademicTerms();

      expect(result).toEqual(terms);

      expect(academicTermRepositoryMock.find).toHaveBeenCalledWith({
        order: {
          startDate: 'DESC',
        },
      });
    });
  });

  describe('Turmas', () => {
    const dto = {
      code: 'ENGSOFT-2027-A',
      disciplineId: 'discipline-id-1',
      professorId: 'professor-id-1',
      academicTermId: 'term-id-1',
    };

    const discipline = {
      id: dto.disciplineId,
      name: 'Engenharia de Software',
    };

    const professor = {
      id: dto.professorId,
      name: 'Professor Teste',
      role: UserRole.PROFESSOR,
      active: true,
    };

    const academicTerm = {
      id: dto.academicTermId,
      code: '2027/1',
    };

    it('deve cadastrar uma turma válida', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      userRepositoryMock.findOne.mockResolvedValue(professor);
      academicTermRepositoryMock.findOne.mockResolvedValue(academicTerm);

      const classGroup = {
        id: 'class-id-1',
        code: dto.code,
        discipline,
        professor,
        academicTerm,
      };

      classGroupRepositoryMock.create.mockReturnValue(classGroup);
      classGroupRepositoryMock.save.mockResolvedValue(classGroup);

      const result = await service.createClassGroup(dto);

      expect(disciplineRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.disciplineId },
      });

      expect(userRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.professorId },
      });

      expect(academicTermRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.academicTermId },
      });

      expect(classGroupRepositoryMock.create).toHaveBeenCalledWith({
        code: dto.code,
        discipline,
        professor,
        academicTerm,
      });

      expect(classGroupRepositoryMock.save).toHaveBeenCalledWith(classGroup);

      expect(result).toEqual(classGroup);
    });

    it('deve rejeitar uma disciplina inexistente', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createClassGroup(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(classGroupRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um professor inexistente', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      userRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createClassGroup(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(classGroupRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um professor inativo', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);

      userRepositoryMock.findOne.mockResolvedValue({
        ...professor,
        active: false,
      });

      await expect(service.createClassGroup(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(classGroupRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um usuário que não é professor', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);

      userRepositoryMock.findOne.mockResolvedValue({
        ...professor,
        role: UserRole.STUDENT,
      });

      await expect(service.createClassGroup(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(classGroupRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um semestre inexistente', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      userRepositoryMock.findOne.mockResolvedValue(professor);
      academicTermRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createClassGroup(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(classGroupRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve consultar as turmas com seus relacionamentos', async () => {
      const classes = [
        {
          id: 'class-id-1',
          code: dto.code,
          discipline,
          professor,
          academicTerm,
        },
      ];

      classGroupRepositoryMock.find.mockResolvedValue(classes);

      const result = await service.findClasses();

      expect(result).toEqual(classes);

      expect(classGroupRepositoryMock.find).toHaveBeenCalledWith({
        relations: {
          discipline: {
            course: true,
          },
          professor: true,
          academicTerm: true,
        },
        order: {
          code: 'ASC',
        },
      });
    });
  });
});
