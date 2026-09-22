import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Discipline } from './discipline.entity';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Discipline, (discipline) => discipline.course)
  disciplines: Discipline[];
}