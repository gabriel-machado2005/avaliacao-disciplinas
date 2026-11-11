import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateAcademicTermDto } from './dto/create-academic-term.dto';
import { CreateClassGroupDto } from './dto/create-class-group.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { AcademicTerm } from './entities/academic-term.entity';
import { ClassGroup } from './entities/class-group.entity';
import { Course } from './entities/course.entity';
import { Discipline } from './entities/discipline.entity';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { UpdateAcademicTermDto } from './dto/update-academic-term.dto';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { UpdateClassGroupDto } from './dto/update-class-group.dto';

@Injectable()
export class AcademicService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,

    @InjectRepository(Discipline)
    private readonly disciplineRepository: Repository<Discipline>,

    @InjectRepository(AcademicTerm)
    private readonly academicTermRepository: Repository<AcademicTerm>,

    @InjectRepository(ClassGroup)
    private readonly classGroupRepository: Repository<ClassGroup>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
  ) {}

  async createCourse(dto: CreateCourseDto) {
    const existing = await this.courseRepository.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException('Código de curso já cadastrado.');
    }

    return this.courseRepository.save(this.courseRepository.create(dto));
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    const course = await this.courseRepository.findOne({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado.');
    }

    if (dto.code === undefined && dto.name === undefined) {
      throw new BadRequestException(
        'Informe pelo menos um campo para atualizar.',
      );
    }

    if (dto.code !== undefined && dto.code !== course.code) {
      const existing = await this.courseRepository.findOne({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException('Código de curso já cadastrado.');
      }

      course.code = dto.code;
    }

    if (dto.name !== undefined) {
      course.name = dto.name;
    }

    return this.courseRepository.save(course);
  }

  async deleteCourse(id: string) {
    const course = await this.courseRepository.findOne({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado.');
    }

    const linkedDisciplines = await this.disciplineRepository.count({
      where: {
        course: { id },
      },
    });

    if (linkedDisciplines > 0) {
      throw new ConflictException(
        'Não é possível excluir este curso porque existem disciplinas vinculadas a ele.',
      );
    }

    try {
      const result = await this.courseRepository.delete(id);

      if (result.affected === 0) {
        throw new NotFoundException('Curso não encontrado.');
      }
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23503'
      ) {
        throw new ConflictException(
          'Não é possível excluir este curso porque existem registros vinculados a ele.',
        );
      }

      throw error;
    }

    return { message: 'Curso excluído com sucesso.' };
  }

  findCourses() {
    return this.courseRepository.find({
      order: { name: 'ASC' },
    });
  }

  async createDiscipline(dto: CreateDisciplineDto) {
    const course = await this.courseRepository.findOne({
      where: { id: dto.courseId },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado.');
    }

    const existing = await this.disciplineRepository.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException('Código de disciplina já cadastrado.');
    }

    const discipline = this.disciplineRepository.create({
      code: dto.code,
      name: dto.name,
      course,
    });

    return this.disciplineRepository.save(discipline);
  }

  async updateDiscipline(id: string, dto: UpdateDisciplineDto) {
    const discipline = await this.disciplineRepository.findOne({
      where: { id },
      relations: {
        course: true,
      },
    });

    if (!discipline) {
      throw new NotFoundException('Disciplina não encontrada.');
    }

    if (
      dto.code === undefined &&
      dto.name === undefined &&
      dto.courseId === undefined
    ) {
      throw new BadRequestException(
        'Informe pelo menos um campo para atualizar.',
      );
    }

    if (dto.code !== undefined && dto.code !== discipline.code) {
      const existing = await this.disciplineRepository.findOne({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException('Código de disciplina já cadastrado.');
      }

      discipline.code = dto.code;
    }

    if (dto.courseId !== undefined) {
      const course = await this.courseRepository.findOne({
        where: { id: dto.courseId },
      });

      if (!course) {
        throw new NotFoundException('Curso não encontrado.');
      }

      if (discipline.course?.id !== course.id) {
        const linkedClasses = await this.classGroupRepository.count({
          where: {
            discipline: { id },
          },
        });

        if (linkedClasses > 0) {
          throw new ConflictException(
            'Não é possível alterar o curso desta disciplina porque existem turmas vinculadas a ela.',
          );
        }
      }

      discipline.course = course;
    }

    if (dto.name !== undefined) {
      discipline.name = dto.name;
    }

    return this.disciplineRepository.save(discipline);
  }

  async deleteDiscipline(id: string) {
    const discipline = await this.disciplineRepository.findOne({
      where: { id },
    });

    if (!discipline) {
      throw new NotFoundException('Disciplina não encontrada.');
    }

    const linkedClasses = await this.classGroupRepository.count({
      where: {
        discipline: { id },
      },
    });

    if (linkedClasses > 0) {
      throw new ConflictException(
        'Não é possível excluir esta disciplina porque existem turmas vinculadas a ela.',
      );
    }

    try {
      const result = await this.disciplineRepository.delete(id);

      if (result.affected === 0) {
        throw new NotFoundException('Disciplina não encontrada.');
      }
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23503'
      ) {
        throw new ConflictException(
          'Não é possível excluir esta disciplina porque existem registros vinculados a ela.',
        );
      }

      throw error;
    }

    return { message: 'Disciplina excluída com sucesso.' };
  }

  findDisciplines() {
    return this.disciplineRepository.find({
      relations: {
        course: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  async createAcademicTerm(dto: CreateAcademicTermDto) {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException(
        'A data final deve ser posterior à data inicial.',
      );
    }

    const existing = await this.academicTermRepository.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException('Período letivo já cadastrado.');
    }

    return this.academicTermRepository.save(
      this.academicTermRepository.create(dto),
    );
  }

  async updateAcademicTerm(id: string, dto: UpdateAcademicTermDto) {
    const academicTerm = await this.academicTermRepository.findOne({
      where: { id },
    });

    if (!academicTerm) {
      throw new NotFoundException('Período letivo não encontrado.');
    }

    if (
      dto.code === undefined &&
      dto.startDate === undefined &&
      dto.endDate === undefined
    ) {
      throw new BadRequestException(
        'Informe pelo menos um campo para atualizar.',
      );
    }

    const startDate = dto.startDate ?? academicTerm.startDate;
    const endDate = dto.endDate ?? academicTerm.endDate;

    if (new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'A data final deve ser posterior à data inicial.',
      );
    }

    if (dto.code !== undefined && dto.code !== academicTerm.code) {
      const existing = await this.academicTermRepository.findOne({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException('Período letivo já cadastrado.');
      }
    }

    const datesChanged =
      startDate !== academicTerm.startDate || endDate !== academicTerm.endDate;

    if (datesChanged) {
      const linkedClasses = await this.classGroupRepository.count({
        where: {
          academicTerm: { id },
        },
      });

      if (linkedClasses > 0) {
        throw new ConflictException(
          'Não é possível alterar as datas deste período letivo porque existem turmas vinculadas a ele.',
        );
      }
    }

    academicTerm.code = dto.code ?? academicTerm.code;
    academicTerm.startDate = startDate;
    academicTerm.endDate = endDate;

    return this.academicTermRepository.save(academicTerm);
  }

  async deleteAcademicTerm(id: string) {
    const academicTerm = await this.academicTermRepository.findOne({
      where: { id },
    });

    if (!academicTerm) {
      throw new NotFoundException('Período letivo não encontrado.');
    }

    const linkedClasses = await this.classGroupRepository.count({
      where: {
        academicTerm: { id },
      },
    });

    if (linkedClasses > 0) {
      throw new ConflictException(
        'Não é possível excluir este período letivo porque existem turmas vinculadas a ele.',
      );
    }

    try {
      const result = await this.academicTermRepository.delete(id);

      if (!result.affected) {
        throw new NotFoundException('Período letivo não encontrado.');
      }

      return {
        message: 'Período letivo excluído com sucesso.',
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23503'
      ) {
        throw new ConflictException(
          'Não é possível excluir este período letivo porque existem registros vinculados a ele.',
        );
      }

      throw error;
    }
  }

  findAcademicTerms() {
    return this.academicTermRepository.find({
      order: {
        startDate: 'DESC',
      },
    });
  }

  async createClassGroup(dto: CreateClassGroupDto) {
    const discipline = await this.disciplineRepository.findOne({
      where: { id: dto.disciplineId },
    });

    if (!discipline) {
      throw new NotFoundException('Disciplina não encontrada.');
    }

    const professor = await this.userRepository.findOne({
      where: { id: dto.professorId },
    });

    if (!professor) {
      throw new NotFoundException('Professor não encontrado.');
    }

    if (professor.role !== UserRole.PROFESSOR || !professor.active) {
      throw new BadRequestException(
        'O usuário informado deve ser um professor ativo.',
      );
    }

    const academicTerm = await this.academicTermRepository.findOne({
      where: { id: dto.academicTermId },
    });

    if (!academicTerm) {
      throw new NotFoundException('Período letivo não encontrado.');
    }

    const classGroup = this.classGroupRepository.create({
      code: dto.code,
      discipline,
      professor,
      academicTerm,
    });

    return this.classGroupRepository.save(classGroup);
  }

  async updateClassGroup(id: string, dto: UpdateClassGroupDto) {
    const classGroup = await this.classGroupRepository.findOne({
      where: { id },
      relations: {
        discipline: true,
        professor: true,
        academicTerm: true,
      },
    });

    if (!classGroup) {
      throw new NotFoundException('Turma não encontrada.');
    }

    if (
      dto.code === undefined &&
      dto.disciplineId === undefined &&
      dto.professorId === undefined &&
      dto.academicTermId === undefined
    ) {
      throw new BadRequestException(
        'Informe pelo menos um campo para atualizar.',
      );
    }

    const disciplineChanged =
      dto.disciplineId !== undefined &&
      dto.disciplineId !== classGroup.discipline.id;

    const professorChanged =
      dto.professorId !== undefined &&
      dto.professorId !== classGroup.professor.id;

    const academicTermChanged =
      dto.academicTermId !== undefined &&
      dto.academicTermId !== classGroup.academicTerm.id;

    if (disciplineChanged || professorChanged || academicTermChanged) {
      const linkedEvaluations = await this.evaluationRepository.count({
        where: {
          classGroup: { id },
        },
      });

      if (linkedEvaluations > 0) {
        throw new ConflictException(
          'Não é possível alterar disciplina, professor ou semestre desta turma porque existem avaliações vinculadas a ela.',
        );
      }
    }

    if (
      dto.disciplineId !== undefined &&
      dto.disciplineId !== classGroup.discipline.id
    ) {
      const discipline = await this.disciplineRepository.findOne({
        where: { id: dto.disciplineId },
      });

      if (!discipline) {
        throw new NotFoundException('Disciplina não encontrada.');
      }

      classGroup.discipline = discipline;
    }

    if (
      dto.professorId !== undefined &&
      dto.professorId !== classGroup.professor.id
    ) {
      const professor = await this.userRepository.findOne({
        where: { id: dto.professorId },
      });

      if (!professor) {
        throw new NotFoundException('Professor não encontrado.');
      }

      if (professor.role !== UserRole.PROFESSOR || !professor.active) {
        throw new BadRequestException(
          'O usuário informado deve ser um professor ativo.',
        );
      }

      classGroup.professor = professor;
    }

    if (
      dto.academicTermId !== undefined &&
      dto.academicTermId !== classGroup.academicTerm.id
    ) {
      const academicTerm = await this.academicTermRepository.findOne({
        where: { id: dto.academicTermId },
      });

      if (!academicTerm) {
        throw new NotFoundException('Período letivo não encontrado.');
      }

      classGroup.academicTerm = academicTerm;
    }

    if (dto.code !== undefined) {
      classGroup.code = dto.code;
    }

    return this.classGroupRepository.save(classGroup);
  }

  async deleteClassGroup(id: string) {
    const classGroup = await this.classGroupRepository.findOne({
      where: { id },
    });

    if (!classGroup) {
      throw new NotFoundException('Turma não encontrada.');
    }

    const linkedEvaluations = await this.evaluationRepository.count({
      where: {
        classGroup: { id },
      },
    });

    if (linkedEvaluations > 0) {
      throw new ConflictException(
        'Não é possível excluir esta turma porque existem avaliações vinculadas a ela.',
      );
    }

    try {
      const result = await this.classGroupRepository.delete(id);

      if (!result.affected) {
        throw new NotFoundException('Turma não encontrada.');
      }

      return {
        message: 'Turma excluída com sucesso.',
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23503'
      ) {
        throw new ConflictException(
          'Não é possível excluir esta turma porque existem registros vinculados a ela.',
        );
      }

      throw error;
    }
  }

  findClasses() {
    return this.classGroupRepository.find({
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
  }
}
