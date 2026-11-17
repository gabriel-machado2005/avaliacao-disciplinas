import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'GRANT_ELIGIBILITY'
  | 'REVOKE_ELIGIBILITY'
  | 'UPDATE_MIN_RESPONSES'
  | 'SET_FOLLOW_UP'
  | 'CLEAR_FOLLOW_UP';

export type AuditResource =
  | 'USER'
  | 'COURSE'
  | 'DISCIPLINE'
  | 'ACADEMIC_TERM'
  | 'CLASS_GROUP'
  | 'QUESTIONNAIRE'
  | 'DIMENSION'
  | 'QUESTION'
  | 'EVALUATION_PERIOD'
  | 'EVALUATION'
  | 'IMPROVEMENT_PLAN';

@Entity('administrative_audit_events')
@Index(['resourceType', 'resourceId', 'occurredAt'])
export class AdministrativeAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Keep the actor and resource identifiers even if their records are removed.
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 32 })
  action: AuditAction;

  @Column({ name: 'resource_type', type: 'varchar', length: 32 })
  resourceType: AuditResource;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
