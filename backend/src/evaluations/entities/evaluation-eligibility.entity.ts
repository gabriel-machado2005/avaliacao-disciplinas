import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_eligibilities')
@Unique(['evaluation', 'student'])
export class EvaluationEligibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluation_id' })
  evaluation: Evaluation;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({
  default: false,
  })
  completed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}