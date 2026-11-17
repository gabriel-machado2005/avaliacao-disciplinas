import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  ImprovementPlan,
  ImprovementPlanStatus,
} from './improvement-plan.entity';

@Entity('improvement_plan_status_history')
@Index(['planId', 'id'])
export class ImprovementPlanStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => ImprovementPlan, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'plan_id' })
  plan: ImprovementPlan;

  @Column({
    name: 'previous_status',
    type: 'enum',
    enum: ImprovementPlanStatus,
    enumName: 'improvement_plan_status',
    nullable: true,
  })
  previousStatus: ImprovementPlanStatus | null;

  @Column({
    type: 'enum',
    enum: ImprovementPlanStatus,
    enumName: 'improvement_plan_status',
  })
  status: ImprovementPlanStatus;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;
}
