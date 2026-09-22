import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { ClassGroup } from './class-group.entity';

@Entity('disciplines')
export class Discipline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => Course, (course) => course.disciplines, {
    nullable: false,
  })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @OneToMany(() => ClassGroup, (classGroup) => classGroup.discipline)
  classes: ClassGroup[];
}