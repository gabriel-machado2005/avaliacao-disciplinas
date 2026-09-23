import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dimension } from './dimension.entity';

export enum QuestionType {
  SCALE = 'SCALE',
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  TEXT = 'TEXT',
}

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({
    type: 'enum',
    enum: QuestionType,
  })
  type: QuestionType;

  @Column({ default: false })
  required: boolean;

  @Column({ default: 0 })
  order: number;

  @Column({
    name: 'scale_min',
    type: 'int',
    nullable: true,
  })
  scaleMin: number | null;

  @Column({
    name: 'scale_max',
    type: 'int',
    nullable: true,
  })
  scaleMax: number | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  options: string[] | null;

  @ManyToOne(
    () => Dimension,
    (dimension) => dimension.questions,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'dimension_id' })
  dimension: Dimension;
}