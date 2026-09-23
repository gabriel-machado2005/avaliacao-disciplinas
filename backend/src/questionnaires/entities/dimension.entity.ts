import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Questionnaire } from './questionnaire.entity';
import { Question } from './question.entity';

@Entity('dimensions')
export class Dimension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 0 })
  order: number;

  @ManyToOne(
    () => Questionnaire,
    (questionnaire) => questionnaire.dimensions,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'questionnaire_id' })
  questionnaire: Questionnaire;

  @OneToMany(
    () => Question,
    (question) => question.dimension,
  )
  questions: Question[];
}