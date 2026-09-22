import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AcademicTerm } from './academic-term.entity';
import { Discipline } from './discipline.entity';

@Entity('classes')
export class ClassGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30 })
  code: string;

  @ManyToOne(() => Discipline, (discipline) => discipline.classes, {
    nullable: false,
  })
  @JoinColumn({ name: 'discipline_id' })
  discipline: Discipline;

  @ManyToOne(() => User, {
    nullable: false,
  })
  @JoinColumn({ name: 'professor_id' })
  professor: User;

  @ManyToOne(() => AcademicTerm, (academicTerm) => academicTerm.classes, {
    nullable: false,
  })
  @JoinColumn({ name: 'academic_term_id' })
  academicTerm: AcademicTerm;
}