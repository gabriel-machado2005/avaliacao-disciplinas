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

    it('deve atualizar o nome de uma disciplina existente', async () => {
      const discipline = {
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        course: { id: 'course-id-1' },
      };

      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      disciplineRepositoryMock.save.mockImplementation(async (value) => value);

      const result = await service.updateDiscipline(discipline.id, {
        name: 'Engenharia de Software I',
      });

      expect(result.name).toBe('Engenharia de Software I');
      expect(result.code).toBe('ENGSOFT');
      expect(result.course.id).toBe('course-id-1');
      expect(disciplineRepositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('deve permitir alterar o curso de uma disciplina', async () => {
      const discipline = {
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        course: { id: 'course-id-1' },
      };

      const newCourse = {
        id: 'course-id-2',
        code: 'SI',
        name: 'Sistemas de Informação',
      };

      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      courseRepositoryMock.findOne.mockResolvedValue(newCourse);
      classGroupRepositoryMock.count.mockResolvedValue(0);
      disciplineRepositoryMock.save.mockImplementation(async (value) => value);

      const result = await service.updateDiscipline(discipline.id, {
        courseId: newCourse.id,
      });

      expect(courseRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: newCourse.id },
      });

      expect(result.course).toEqual(newCourse);
    });

    it('deve rejeitar a edição com código duplicado', async () => {
      const discipline = {
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
      };

      const otherDiscipline = {
        id: 'discipline-id-2',
        code: 'BD',
        name: 'Banco de Dados',
      };

      disciplineRepositoryMock.findOne
        .mockResolvedValueOnce(discipline)
        .mockResolvedValueOnce(otherDiscipline);

      await expect(
        service.updateDiscipline(discipline.id, {
          code: 'BD',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar a edição de uma disciplina inexistente', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateDiscipline('discipline-id-inexistente', {
          name: 'Novo nome',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar vínculo com curso inexistente', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
      });

      courseRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateDiscipline('discipline-id-1', {
          courseId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar atualização de disciplina sem campos', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
      });

      await expect(
        service.updateDiscipline('discipline-id-1', {}),
      ).rejects.toThrow(BadRequestException);

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve excluir uma disciplina sem turmas vinculadas', async () => {
      const disciplineId = 'discipline-id-1';

      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: disciplineId,
        code: 'TESTE',
        name: 'Disciplina de Teste',
      });

      classGroupRepositoryMock.count.mockResolvedValue(0);
      disciplineRepositoryMock.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteDiscipline(disciplineId);

      expect(classGroupRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          discipline: { id: disciplineId },
        },
      });

      expect(disciplineRepositoryMock.delete).toHaveBeenCalledWith(
        disciplineId,
      );

      expect(result).toEqual({
        message: 'Disciplina excluída com sucesso.',
      });
    });

    it('deve impedir a exclusão de disciplina com turmas vinculadas', async () => {
      const disciplineId = 'discipline-id-1';

      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: disciplineId,
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
      });

      classGroupRepositoryMock.count.mockResolvedValue(2);

      await expect(service.deleteDiscipline(disciplineId)).rejects.toThrow(
        ConflictException,
      );

      expect(disciplineRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deve rejeitar a exclusão de uma disciplina inexistente', async () => {
      disciplineRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.deleteDiscipline('discipline-id-inexistente'),
      ).rejects.toThrow(NotFoundException);

      expect(classGroupRepositoryMock.count).not.toHaveBeenCalled();
      expect(disciplineRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deve tratar exclusão de disciplina sem registro afetado', async () => {
      const disciplineId = 'discipline-id-1';

      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: disciplineId,
        code: 'TESTE',
        name: 'Disciplina de Teste',
      });

      classGroupRepositoryMock.count.mockResolvedValue(0);
      disciplineRepositoryMock.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteDiscipline(disciplineId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve tratar erro de chave estrangeira ao excluir disciplina', async () => {
      const disciplineId = 'discipline-id-1';

      disciplineRepositoryMock.findOne.mockResolvedValue({
        id: disciplineId,
        code: 'TESTE',
        name: 'Disciplina de Teste',
      });

      classGroupRepositoryMock.count.mockResolvedValue(0);

      const driverError = Object.assign(
        new Error('Violação de chave estrangeira.'),
        {
          code: '23503',
          detail: 'Registro referenciado por uma chave estrangeira.',
        },
      );

      const databaseError = new QueryFailedError(
        'DELETE FROM disciplines WHERE id = $1',
        [disciplineId],
        driverError,
      );

      disciplineRepositoryMock.delete.mockRejectedValue(databaseError);

      await expect(service.deleteDiscipline(disciplineId)).rejects.toThrow(
        ConflictException,
      );

      expect(disciplineRepositoryMock.delete).toHaveBeenCalledWith(
        disciplineId,
      );
    });

    it('deve impedir a transferência de disciplina com turmas vinculadas', async () => {
      const discipline = {
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        course: { id: 'course-id-1' },
      };

      const newCourse = {
        id: 'course-id-2',
        code: 'SI',
        name: 'Sistemas de Informação',
      };

      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      courseRepositoryMock.findOne.mockResolvedValue(newCourse);
      classGroupRepositoryMock.count.mockResolvedValue(2);

      await expect(
        service.updateDiscipline(discipline.id, {
          courseId: newCourse.id,
        }),
      ).rejects.toThrow(ConflictException);

      expect(classGroupRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          discipline: { id: discipline.id },
        },
      });

      expect(disciplineRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve permitir manter o mesmo curso quando existem turmas', async () => {
      const course = {
        id: 'course-id-1',
        code: 'CC',
        name: 'Ciência da Computação',
      };

      const discipline = {
        id: 'discipline-id-1',
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        course,
      };

      disciplineRepositoryMock.findOne.mockResolvedValue(discipline);
      courseRepositoryMock.findOne.mockResolvedValue(course);
      disciplineRepositoryMock.save.mockImplementation(async (value) => value);

      const result = await service.updateDiscipline(discipline.id, {
        name: 'Engenharia de Software I',
        courseId: course.id,
      });

      expect(result.name).toBe('Engenharia de Software I');
      expect(result.course.id).toBe(course.id);

      expect(classGroupRepositoryMock.count).not.toHaveBeenCalled();
      expect(disciplineRepositoryMock.save).toHaveBeenCalledTimes(1);
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

    it('deve atualizar o código de um período letivo', async () => {
      const term = {
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      academicTermRepositoryMock.findOne
        .mockResolvedValueOnce(term)
        .mockResolvedValueOnce(null);

      academicTermRepositoryMock.save.mockImplementation(
        async (value) => value,
      );

      const result = await service.updateAcademicTerm(term.id, {
        code: '2027-A',
      });

      expect(result.code).toBe('2027-A');
      expect(result.startDate).toBe('2027-03-01');
      expect(result.endDate).toBe('2027-07-31');
      expect(academicTermRepositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('deve atualizar a data final quando não existem turmas', async () => {
      const term = {
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      academicTermRepositoryMock.findOne.mockResolvedValue(term);
      classGroupRepositoryMock.count.mockResolvedValue(0);
      academicTermRepositoryMock.save.mockImplementation(
        async (value) => value,
      );

      const result = await service.updateAcademicTerm(term.id, {
        endDate: '2027-08-15',
      });

      expect(classGroupRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          academicTerm: { id: term.id },
        },
      });

      expect(result.endDate).toBe('2027-08-15');
      expect(result.startDate).toBe('2027-03-01');
    });

    it('deve rejeitar código de período letivo duplicado', async () => {
      const term = {
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      const otherTerm = {
        id: 'term-id-2',
        code: '2027/2',
      };

      academicTermRepositoryMock.findOne
        .mockResolvedValueOnce(term)
        .mockResolvedValueOnce(otherTerm);

      await expect(
        service.updateAcademicTerm(term.id, {
          code: '2027/2',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar atualização com datas inválidas', async () => {
      const term = {
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      academicTermRepositoryMock.findOne.mockResolvedValue(term);

      await expect(
        service.updateAcademicTerm(term.id, {
          endDate: '2027-02-28',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve impedir alteração de datas quando existem turmas', async () => {
      const term = {
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      academicTermRepositoryMock.findOne.mockResolvedValue(term);
      classGroupRepositoryMock.count.mockResolvedValue(2);

      await expect(
        service.updateAcademicTerm(term.id, {
          endDate: '2027-08-15',
        }),
      ).rejects.toThrow(ConflictException);

      expect(classGroupRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          academicTerm: { id: term.id },
        },
      });

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve permitir alterar o código mesmo com turmas vinculadas', async () => {
      const term = {
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      academicTermRepositoryMock.findOne
        .mockResolvedValueOnce(term)
        .mockResolvedValueOnce(null);

      academicTermRepositoryMock.save.mockImplementation(
        async (value) => value,
      );

      const result = await service.updateAcademicTerm(term.id, {
        code: '2027-A',
      });

      expect(result.code).toBe('2027-A');
      expect(classGroupRepositoryMock.count).not.toHaveBeenCalled();
      expect(academicTermRepositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('deve rejeitar edição de período letivo inexistente', async () => {
      academicTermRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateAcademicTerm('term-id-inexistente', {
          code: '2027/1',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar atualização de período letivo sem campos', async () => {
      academicTermRepositoryMock.findOne.mockResolvedValue({
        id: 'term-id-1',
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });

      await expect(service.updateAcademicTerm('term-id-1', {})).rejects.toThrow(
        BadRequestException,
      );

      expect(academicTermRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve excluir um período letivo sem turmas vinculadas', async () => {
      const termId = 'term-id-1';

      academicTermRepositoryMock.findOne.mockResolvedValue({
        id: termId,
        code: 'TESTE-2028-B',
      });

      classGroupRepositoryMock.count.mockResolvedValue(0);

      academicTermRepositoryMock.delete.mockResolvedValue({
        affected: 1,
      });

      const result = await service.deleteAcademicTerm(termId);

      expect(classGroupRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          academicTerm: { id: termId },
        },
      });

      expect(academicTermRepositoryMock.delete).toHaveBeenCalledWith(termId);

      expect(result).toEqual({
        message: 'Período letivo excluído com sucesso.',
      });
    });

    it('deve impedir exclusão de período letivo com turmas', async () => {
      const termId = 'term-id-1';

      academicTermRepositoryMock.findOne.mockResolvedValue({
        id: termId,
        code: '2027/1',
      });

      classGroupRepositoryMock.count.mockResolvedValue(2);

      await expect(service.deleteAcademicTerm(termId)).rejects.toThrow(
        ConflictException,
      );

      expect(academicTermRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deve rejeitar exclusão de período letivo inexistente', async () => {
      academicTermRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.deleteAcademicTerm('term-id-inexistente'),
      ).rejects.toThrow(NotFoundException);

      expect(classGroupRepositoryMock.count).not.toHaveBeenCalled();
      expect(academicTermRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deve tratar exclusão de período letivo sem registro afetado', async () => {
      const termId = 'term-id-1';

      academicTermRepositoryMock.findOne.mockResolvedValue({
        id: termId,
        code: '2027/1',
      });

      classGroupRepositoryMock.count.mockResolvedValue(0);

      academicTermRepositoryMock.delete.mockResolvedValue({
        affected: 0,
      });

      await expect(service.deleteAcademicTerm(termId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve tratar erro de chave estrangeira ao excluir período letivo', async () => {
      const termId = 'term-id-1';

      academicTermRepositoryMock.findOne.mockResolvedValue({
        id: termId,
        code: '2027/1',
      });

      classGroupRepositoryMock.count.mockResolvedValue(0);

      academicTermRepositoryMock.delete.mockRejectedValue(
        new QueryFailedError(
          'DELETE FROM academic_terms WHERE id = $1',
          [termId],
          Object.assign(new Error('Violação de chave estrangeira'), {
            code: '23503',
          }),
        ),
      );

      await expect(service.deleteAcademicTerm(termId)).rejects.toThrow(
        ConflictException,
      );
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
