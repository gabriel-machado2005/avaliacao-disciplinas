import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';

describe('AcademicController', () => {
  let controller: AcademicController;

  const academicServiceMock = {
    createCourse: jest.fn(),
    updateCourse: jest.fn(),
    deleteCourse: jest.fn(),
    findCourses: jest.fn(),
    createDiscipline: jest.fn(),
    updateDiscipline: jest.fn(),
    deleteDiscipline: jest.fn(),
    findDisciplines: jest.fn(),
    createAcademicTerm: jest.fn(),
    updateAcademicTerm: jest.fn(),
    deleteAcademicTerm: jest.fn(),
    findAcademicTerms: jest.fn(),
    createClassGroup: jest.fn(),
    findClasses: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicController],
      providers: [
        {
          provide: AcademicService,
          useValue: academicServiceMock,
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

    controller = module.get<AcademicController>(AcademicController);
  });

  it('deve criar o controller acadêmico corretamente', () => {
    expect(controller).toBeDefined();
  });

  describe('Cursos', () => {
    it('deve encaminhar o cadastro de um curso ao serviço', async () => {
      const dto = {
        code: 'CC',
        name: 'Ciência da Computação',
      };

      const course = {
        id: 'course-id-1',
        ...dto,
      };

      academicServiceMock.createCourse.mockResolvedValue(course);

      const result = await controller.createCourse(dto);

      expect(academicServiceMock.createCourse).toHaveBeenCalledWith(dto);
      expect(academicServiceMock.createCourse).toHaveBeenCalledTimes(1);
      expect(result).toEqual(course);
    });

    it('deve retornar os cursos cadastrados', async () => {
      const courses = [
        {
          id: 'course-id-1',
          code: 'CC',
          name: 'Ciência da Computação',
        },
      ];

      academicServiceMock.findCourses.mockResolvedValue(courses);

      const result = await controller.findCourses();

      expect(academicServiceMock.findCourses).toHaveBeenCalledTimes(1);
      expect(result).toEqual(courses);
    });

    it('deve encaminhar a edição de um curso ao serviço', async () => {
      const courseId = '550e8400-e29b-41d4-a716-446655440000';

      const dto = {
        name: 'Bacharelado em Ciência da Computação',
      };

      const updatedCourse = {
        id: courseId,
        code: 'CC',
        name: dto.name,
      };

      academicServiceMock.updateCourse.mockResolvedValue(updatedCourse);

      const result = await controller.updateCourse(courseId, dto);

      expect(academicServiceMock.updateCourse).toHaveBeenCalledWith(
        courseId,
        dto,
      );

      expect(academicServiceMock.updateCourse).toHaveBeenCalledTimes(1);

      expect(result).toEqual(updatedCourse);
    });

    it('deve encaminhar a exclusão de um curso ao serviço', async () => {
      const courseId = '550e8400-e29b-41d4-a716-446655440000';

      const response = {
        message: 'Curso excluído com sucesso.',
      };

      academicServiceMock.deleteCourse.mockResolvedValue(response);

      const result = await controller.deleteCourse(courseId);

      expect(academicServiceMock.deleteCourse).toHaveBeenCalledWith(courseId);

      expect(academicServiceMock.deleteCourse).toHaveBeenCalledTimes(1);

      expect(result).toEqual(response);
    });
  });

  describe('Disciplinas', () => {
    it('deve encaminhar o cadastro de uma disciplina', async () => {
      const dto = {
        code: 'ENGSOFT',
        name: 'Engenharia de Software',
        courseId: 'course-id-1',
      };

      const discipline = {
        id: 'discipline-id-1',
        ...dto,
      };

      academicServiceMock.createDiscipline.mockResolvedValue(discipline);

      const result = await controller.createDiscipline(dto);

      expect(academicServiceMock.createDiscipline).toHaveBeenCalledWith(dto);
      expect(academicServiceMock.createDiscipline).toHaveBeenCalledTimes(1);
      expect(result).toEqual(discipline);
    });

    it('deve retornar as disciplinas cadastradas', async () => {
      const disciplines = [
        {
          id: 'discipline-id-1',
          code: 'ENGSOFT',
          name: 'Engenharia de Software',
        },
      ];

      academicServiceMock.findDisciplines.mockResolvedValue(disciplines);

      const result = await controller.findDisciplines();

      expect(academicServiceMock.findDisciplines).toHaveBeenCalledTimes(1);
      expect(result).toEqual(disciplines);
    });

    it('deve encaminhar a edição de uma disciplina ao serviço', async () => {
      const disciplineId = '550e8400-e29b-41d4-a716-446655440000';

      const dto = {
        name: 'Engenharia de Software I',
      };

      const updatedDiscipline = {
        id: disciplineId,
        code: 'ENGSOFT',
        name: dto.name,
        course: {
          id: 'course-id-1',
        },
      };

      academicServiceMock.updateDiscipline.mockResolvedValue(updatedDiscipline);

      const result = await controller.updateDiscipline(disciplineId, dto);

      expect(academicServiceMock.updateDiscipline).toHaveBeenCalledWith(
        disciplineId,
        dto,
      );

      expect(academicServiceMock.updateDiscipline).toHaveBeenCalledTimes(1);

      expect(result).toEqual(updatedDiscipline);
    });

    it('deve encaminhar a exclusão de uma disciplina ao serviço', async () => {
      const disciplineId = '550e8400-e29b-41d4-a716-446655440000';

      const response = {
        message: 'Disciplina excluída com sucesso.',
      };

      academicServiceMock.deleteDiscipline.mockResolvedValue(response);

      const result = await controller.deleteDiscipline(disciplineId);

      expect(academicServiceMock.deleteDiscipline).toHaveBeenCalledWith(
        disciplineId,
      );

      expect(academicServiceMock.deleteDiscipline).toHaveBeenCalledTimes(1);

      expect(result).toEqual(response);
    });
  });

  describe('Semestres', () => {
    it('deve encaminhar o cadastro de um semestre', async () => {
      const dto = {
        code: '2027/1',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      };

      const term = {
        id: 'term-id-1',
        ...dto,
      };

      academicServiceMock.createAcademicTerm.mockResolvedValue(term);

      const result = await controller.createAcademicTerm(dto);

      expect(academicServiceMock.createAcademicTerm).toHaveBeenCalledWith(dto);
      expect(academicServiceMock.createAcademicTerm).toHaveBeenCalledTimes(1);
      expect(result).toEqual(term);
    });

    it('deve retornar os semestres cadastrados', async () => {
      const terms = [
        {
          id: 'term-id-1',
          code: '2027/1',
        },
      ];

      academicServiceMock.findAcademicTerms.mockResolvedValue(terms);

      const result = await controller.findAcademicTerms();

      expect(academicServiceMock.findAcademicTerms).toHaveBeenCalledTimes(1);
      expect(result).toEqual(terms);
    });

    it('deve encaminhar a edição de um período letivo ao serviço', async () => {
      const termId = '550e8400-e29b-41d4-a716-446655440000';

      const dto = {
        code: '2027-A',
        endDate: '2027-08-15',
      };

      const updatedTerm = {
        id: termId,
        code: dto.code,
        startDate: '2027-03-01',
        endDate: dto.endDate,
      };

      academicServiceMock.updateAcademicTerm.mockResolvedValue(updatedTerm);

      const result = await controller.updateAcademicTerm(termId, dto);

      expect(academicServiceMock.updateAcademicTerm).toHaveBeenCalledWith(
        termId,
        dto,
      );

      expect(academicServiceMock.updateAcademicTerm).toHaveBeenCalledTimes(1);

      expect(result).toEqual(updatedTerm);
    });

    it('deve encaminhar a exclusão de um período letivo ao serviço', async () => {
      const termId = '550e8400-e29b-41d4-a716-446655440000';

      const expectedResult = {
        message: 'Período letivo excluído com sucesso.',
      };

      academicServiceMock.deleteAcademicTerm.mockResolvedValue(expectedResult);

      const result = await controller.deleteAcademicTerm(termId);

      expect(academicServiceMock.deleteAcademicTerm).toHaveBeenCalledWith(
        termId,
      );

      expect(academicServiceMock.deleteAcademicTerm).toHaveBeenCalledTimes(1);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('Turmas', () => {
    it('deve encaminhar o cadastro de uma turma', async () => {
      const dto = {
        code: 'ENGSOFT-2027-A',
        disciplineId: 'discipline-id-1',
        professorId: 'professor-id-1',
        academicTermId: 'term-id-1',
      };

      const classGroup = {
        id: 'class-id-1',
        ...dto,
      };

      academicServiceMock.createClassGroup.mockResolvedValue(classGroup);

      const result = await controller.createClassGroup(dto);

      expect(academicServiceMock.createClassGroup).toHaveBeenCalledWith(dto);
      expect(academicServiceMock.createClassGroup).toHaveBeenCalledTimes(1);
      expect(result).toEqual(classGroup);
    });

    it('deve retornar as turmas cadastradas', async () => {
      const classes = [
        {
          id: 'class-id-1',
          code: 'ENGSOFT-2027-A',
        },
      ];

      academicServiceMock.findClasses.mockResolvedValue(classes);

      const result = await controller.findClasses();

      expect(academicServiceMock.findClasses).toHaveBeenCalledTimes(1);
      expect(result).toEqual(classes);
    });
  });
});
