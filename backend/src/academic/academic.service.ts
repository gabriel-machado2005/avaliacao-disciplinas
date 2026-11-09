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
