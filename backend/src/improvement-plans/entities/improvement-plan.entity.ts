import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Discipline } from '../../academic/entities/discipline.entity';
import { EvaluationPeriod } from '../../evaluations/entities/evaluation-period.entity';
import { Evaluation } from '../../evaluations/entities/evaluation.entity';
import { User } from '../../users/entities/user.entity';

export enum ImprovementPlanStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('improvement_plans')
@Check(
  'CK_improvement_plans_single_origin',
  '"origin_period_id" IS NULL OR "origin_evaluation_id" IS NULL',
)
export class ImprovementPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'discipline_id', type: 'uuid' })
  disciplineId: string;

  @ManyToOne(() => Discipline, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'discipline_id' })
  discipline: Discipline;

  @Column({ type: 'text' })
  problem: string;

  @Column({ type: 'text' })
  action: string;

  @Index()
  @Column({ name: 'assignee_id', type: 'uuid' })
  assigneeId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({
    type: 'enum',
    enum: ImprovementPlanStatus,
    enumName: 'improvement_plan_status',
    default: ImprovementPlanStatus.PENDING,
  })
  status: ImprovementPlanStatus;

  @Index()
  @Column({ name: 'origin_period_id', type: 'uuid', nullable: true })
  originPeriodId: string | null;

  @ManyToOne(() => EvaluationPeriod, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'origin_period_id' })
  originPeriod: EvaluationPeriod | null;

  @Index()
  @Column({ name: 'origin_evaluation_id', type: 'uuid', nullable: true })
  originEvaluationId: string | null;

  @ManyToOne(() => Evaluation, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'origin_evaluation_id' })
  originEvaluation: Evaluation | null;

  @Index()
  @Column({ name: 'follow_up_period_id', type: 'uuid', nullable: true })
  followUpPeriodId: string | null;

  @ManyToOne(() => EvaluationPeriod, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'follow_up_period_id' })
  followUpPeriod: EvaluationPeriod | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
