import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Question } from '../../questionnaires/entities/question.entity';
import { Submission } from './submission.entity';

@Entity('answers')
@Unique(['submission', 'question'])
export class Answer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => Submission,
    (submission) => submission.answers,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'submission_id' })
  submission: Submission;

  @ManyToOne(() => Question, {
    nullable: false,
  })
  @JoinColumn({ name: 'question_id' })
  question: Question;

  @Column({
    name: 'scale_value',
    type: 'int',
    nullable: true,
  })
  scaleValue: number | null;

  @Column({
    name: 'choice_value',
    type: 'text',
    nullable: true,
  })
  choiceValue: string | null;

  @Column({
    name: 'text_value',
    type: 'text',
    nullable: true,
  })
  textValue: string | null;
}