import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ClassGroup } from '../../academic/entities/class-group.entity';
import { Questionnaire } from '../../questionnaires/entities/questionnaire.entity';
import { EvaluationPeriod } from './evaluation-period.entity';

@Entity('evaluations')
@Unique(['evaluationPeriod', 'classGroup'])
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EvaluationPeriod, {
    nullable: false,
  })
  @JoinColumn({ name: 'evaluation_period_id' })
  evaluationPeriod: EvaluationPeriod;

  @ManyToOne(() => ClassGroup, {
    nullable: false,
  })
  @JoinColumn({ name: 'class_group_id' })
  classGroup: ClassGroup;

  @ManyToOne(() => Questionnaire, {
    nullable: false,
  })
  @JoinColumn({ name: 'questionnaire_id' })
  questionnaire: Questionnaire;

  @Column({
  name: 'min_responses_for_results',
  type: 'int',
  nullable: true,
  })
  minResponsesForResults: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}