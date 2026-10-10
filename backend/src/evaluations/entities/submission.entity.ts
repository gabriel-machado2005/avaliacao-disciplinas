import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Evaluation } from './evaluation.entity';
import { Answer } from './answer.entity';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluation_id' })
  evaluation: Evaluation;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @OneToMany(
    () => Answer,
    (answer) => answer.submission,
  )
  answers: Answer[];
}