import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassGroup } from './class-group.entity';

@Entity('academic_terms')
export class AcademicTerm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  code: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => ClassGroup, (classGroup) => classGroup.academicTerm)
  classes: ClassGroup[];
}