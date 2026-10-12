import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClassGroup } from '../academic/entities/class-group.entity';
import { Questionnaire } from '../questionnaires/entities/questionnaire.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import { EvaluationPeriod } from './entities/evaluation-period.entity';
import { Evaluation } from './entities/evaluation.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateEvaluationEligibilityDto } from './dto/create-evaluation-eligibility.dto';
import { EvaluationEligibility } from './entities/evaluation-eligibility.entity';
import { QuestionType } from '../questionnaires/entities/question.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Answer } from './entities/answer.entity';
import { Submission } from './entities/submission.entity';
import { UpdateEvaluationSettingsDto } from './dto/update-evaluation-settings.dto';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(EvaluationPeriod)
    private readonly evaluationPeriodRepository: Repository<EvaluationPeriod>,

    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,

    @InjectRepository(ClassGroup)
    private readonly classGroupRepository: Repository<ClassGroup>,

    @InjectRepository(Questionnaire)
    private readonly questionnaireRepository: Repository<Questionnaire>,

    @InjectRepository(EvaluationEligibility)
    private readonly evaluationEligibilityRepository: Repository<EvaluationEligibility>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async createPeriod(dto: CreateEvaluationPeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException(
        'A data final deve ser posterior à data inicial.',
      );
    }

    const period = this.evaluationPeriodRepository.create({
      name: dto.name,
      startDate,
      endDate,
    });

    return this.evaluationPeriodRepository.save(period);
  }

  findPeriods() {
    return this.evaluationPeriodRepository.find({
      order: {
        startDate: 'DESC',
      },
    });
  }

  async createEvaluation(dto: CreateEvaluationDto) {
    const evaluationPeriod = await this.evaluationPeriodRepository.findOne({
      where: { id: dto.evaluationPeriodId },
    });

    if (!evaluationPeriod) {
      throw new NotFoundException('Período de avaliação não encontrado.');
    }

    if (!evaluationPeriod.active) {
      throw new BadRequestException('O período de avaliação está inativo.');
    }

    const classGroup = await this.classGroupRepository.findOne({
      where: { id: dto.classGroupId },
    });

    if (!classGroup) {
      throw new NotFoundException('Turma não encontrada.');
    }

    const questionnaire = await this.questionnaireRepository.findOne({
      where: { id: dto.questionnaireId },
    });

    if (!questionnaire) {
      throw new NotFoundException('Questionário não encontrado.');
    }

    if (!questionnaire.active) {
      throw new BadRequestException('O questionário está inativo.');
    }

    const existing = await this.evaluationRepository.findOne({
      where: {
        evaluationPeriod: {
          id: dto.evaluationPeriodId,
        },
        classGroup: {
          id: dto.classGroupId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Já existe uma avaliação para esta turma neste período.',
      );
    }

    const evaluation = this.evaluationRepository.create({
      evaluationPeriod,
      classGroup,
      questionnaire,
      minResponsesForResults: dto.minResponsesForResults,
    });

    return this.evaluationRepository.save(evaluation);
  }

  findEvaluations() {
    return this.evaluationRepository.find({
      relations: {
        evaluationPeriod: true,
        classGroup: {
          discipline: {
            course: true,
          },
          professor: true,
          academicTerm: true,
        },
        questionnaire: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
  async createEligibility(dto: CreateEvaluationEligibilityDto) {
    const evaluation = await this.evaluationRepository.findOne({
      where: {
        id: dto.evaluationId,
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    const student = await this.userRepository.findOne({
      where: {
        id: dto.studentId,
      },
    });

    if (!student) {
      throw new NotFoundException('Estudante não encontrado.');
    }

    if (student.role !== UserRole.STUDENT) {
      throw new BadRequestException(
        'O usuário informado não possui o perfil de estudante.',
      );
    }

    if (!student.active) {
      throw new BadRequestException('O estudante informado está inativo.');
    }

    const existing = await this.evaluationEligibilityRepository.findOne({
      where: {
        evaluation: {
          id: dto.evaluationId,
        },
        student: {
          id: dto.studentId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'O estudante já possui elegibilidade para esta avaliação.',
      );
    }

    const eligibility = this.evaluationEligibilityRepository.create({
      evaluation,
      student,
      completed: false,
    });

    return this.evaluationEligibilityRepository.save(eligibility);
  }
  async findEligibilities(evaluationId: string) {
    const evaluation = await this.evaluationRepository.findOne({
      where: {
        id: evaluationId,
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    return this.evaluationEligibilityRepository.find({
      where: {
        evaluation: {
          id: evaluationId,
        },
      },
      relations: {
        student: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
  async findMyEvaluations(studentId: string) {
    return this.evaluationEligibilityRepository.find({
      where: {
        student: {
          id: studentId,
        },
      },
      relations: {
        evaluation: {
          evaluationPeriod: true,
          classGroup: {
            discipline: {
              course: true,
            },
            professor: true,
            academicTerm: true,
          },
          questionnaire: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
  async submitEvaluation(
    evaluationId: string,
    studentId: string,
    dto: CreateSubmissionDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const eligibilityRepository = manager.getRepository(
        EvaluationEligibility,
      );

      const evaluationRepository = manager.getRepository(Evaluation);

      const submissionRepository = manager.getRepository(Submission);

      const answerRepository = manager.getRepository(Answer);

      /*
       * Busca e bloqueia a elegibilidade enquanto a submissão
       * está sendo processada.
       */
      const eligibility = await eligibilityRepository.findOne({
        where: {
          evaluation: {
            id: evaluationId,
          },
          student: {
            id: studentId,
          },
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!eligibility) {
        throw new ForbiddenException(
          'Você não está habilitado para responder esta avaliação.',
        );
      }

      if (eligibility.completed) {
        throw new BadRequestException('Esta avaliação já foi respondida.');
      }

      const evaluation = await evaluationRepository.findOne({
        where: {
          id: evaluationId,
        },
        relations: {
          evaluationPeriod: true,
          questionnaire: {
            dimensions: {
              questions: true,
            },
          },
        },
      });

      if (!evaluation) {
        throw new NotFoundException('Avaliação não encontrada.');
      }

      if (!evaluation.evaluationPeriod.active) {
        throw new BadRequestException('O período de avaliação está inativo.');
      }

      const now = new Date();

      const startDate = new Date(evaluation.evaluationPeriod.startDate);

      const endDate = new Date(evaluation.evaluationPeriod.endDate);

      if (now < startDate || now > endDate) {
        throw new BadRequestException(
          'Esta avaliação está fora do período permitido para respostas.',
        );
      }

      if (!evaluation.questionnaire.active) {
        throw new BadRequestException(
          'O questionário desta avaliação está inativo.',
        );
      }

      const questions = evaluation.questionnaire.dimensions.flatMap(
        (dimension) => dimension.questions,
      );

      const questionMap = new Map(
        questions.map((question) => [question.id, question]),
      );

      /*
       * Impede a mesma pergunta de ser enviada duas vezes.
       */
      const submittedQuestionIds = dto.answers.map(
        (answer) => answer.questionId,
      );

      const uniqueQuestionIds = new Set(submittedQuestionIds);

      if (uniqueQuestionIds.size !== submittedQuestionIds.length) {
        throw new BadRequestException(
          'Existem perguntas duplicadas na submissão.',
        );
      }

      /*
       * Todas as perguntas enviadas precisam pertencer
       * ao questionário desta avaliação.
       */
      for (const answer of dto.answers) {
        if (!questionMap.has(answer.questionId)) {
          throw new BadRequestException(
            'Uma das perguntas informadas não pertence ao questionário desta avaliação.',
          );
        }
      }

      /*
       * Verifica se todas as perguntas obrigatórias
       * foram respondidas.
       */
      const requiredQuestions = questions.filter(
        (question) => question.required,
      );

      for (const question of requiredQuestions) {
        if (!uniqueQuestionIds.has(question.id)) {
          throw new BadRequestException(
            `A pergunta obrigatória "${question.text}" não foi respondida.`,
          );
        }
      }

      /*
       * Validação das respostas de acordo
       * com o tipo da pergunta.
       */
      for (const answerDto of dto.answers) {
        const question = questionMap.get(answerDto.questionId)!;

        const hasScale =
          answerDto.scaleValue !== undefined && answerDto.scaleValue !== null;

        const hasChoice =
          answerDto.choiceValue !== undefined && answerDto.choiceValue !== null;

        const hasText =
          answerDto.textValue !== undefined && answerDto.textValue !== null;

        switch (question.type) {
          case QuestionType.SCALE:
            if (!hasScale || hasChoice || hasText) {
              throw new BadRequestException(
                `Resposta inválida para a pergunta "${question.text}".`,
              );
            }

            if (question.scaleMin === null || question.scaleMax === null) {
              throw new BadRequestException(
                `A pergunta "${question.text}" não possui uma escala válida configurada.`,
              );
            }

            if (
              answerDto.scaleValue! < question.scaleMin ||
              answerDto.scaleValue! > question.scaleMax
            ) {
              throw new BadRequestException(
                `O valor da pergunta "${question.text}" deve estar entre ${question.scaleMin} e ${question.scaleMax}.`,
              );
            }

            break;

          case QuestionType.SINGLE_CHOICE:
            if (!hasChoice || hasScale || hasText) {
              throw new BadRequestException(
                `Resposta inválida para a pergunta "${question.text}".`,
              );
            }

            if (!question.options?.includes(answerDto.choiceValue!)) {
              throw new BadRequestException(
                `A opção informada para a pergunta "${question.text}" é inválida.`,
              );
            }

            break;

          case QuestionType.TEXT:
            if (!hasText || hasScale || hasChoice) {
              throw new BadRequestException(
                `Resposta inválida para a pergunta "${question.text}".`,
              );
            }

            if (answerDto.textValue!.trim().length === 0) {
              throw new BadRequestException(
                `A resposta da pergunta "${question.text}" não pode estar vazia.`,
              );
            }

            break;
        }
      }

      /*
       * A partir daqui todas as validações passaram.
       * Criamos uma submissão SEM studentId.
       */
      const submission = submissionRepository.create({
        evaluation,
      });

      const savedSubmission = await submissionRepository.save(submission);

      const answers = dto.answers.map((answerDto) => {
        const question = questionMap.get(answerDto.questionId)!;

        return answerRepository.create({
          submission: savedSubmission,
          question,
          scaleValue: answerDto.scaleValue ?? null,
          choiceValue: answerDto.choiceValue ?? null,
          textValue: answerDto.textValue ?? null,
        });
      });

      await answerRepository.save(answers);

      /*
       * Sabemos apenas que o estudante terminou.
       * Não vinculamos sua identidade à Submission.
       */
      eligibility.completed = true;

      await eligibilityRepository.save(eligibility);

      return {
        submissionId: savedSubmission.id,
        evaluationId: evaluation.id,
        submittedAt: savedSubmission.submittedAt,
        answersCount: answers.length,
      };
    });
  }
  async getResults(
    evaluationId: string,
    requester: {
      userId: string;
      role: UserRole;
    },
  ) {
    const evaluation = await this.evaluationRepository.findOne({
      where: {
        id: evaluationId,
      },
      relations: {
        evaluationPeriod: true,
        classGroup: {
          discipline: {
            course: true,
          },
          professor: true,
          academicTerm: true,
        },
        questionnaire: {
          dimensions: {
            questions: true,
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    /*
     * Professor só pode consultar resultados
     * de uma turma atribuída a ele.
     */
    if (requester.role === UserRole.PROFESSOR) {
      if (evaluation.classGroup.professor.id !== requester.userId) {
        throw new ForbiddenException(
          'Você não possui acesso aos resultados desta avaliação.',
        );
      }
    }

    /*
     * Proteção adicional caso outro perfil
     * consiga chamar o service indevidamente.
     */
    if (
      requester.role !== UserRole.ADMIN &&
      requester.role !== UserRole.COORDINATOR &&
      requester.role !== UserRole.PROFESSOR
    ) {
      throw new ForbiddenException('Você não possui acesso aos resultados.');
    }

    /*
     * Resultados somente depois do encerramento.
     */
    const now = new Date();
    const endDate = new Date(evaluation.evaluationPeriod.endDate);

    if (now <= endDate) {
      throw new BadRequestException(
        'Os resultados estarão disponíveis somente após o encerramento do período de avaliação.',
      );
    }

    /*
     * Avaliações antigas podem ainda estar
     * sem essa configuração.
     */
    if (evaluation.minResponsesForResults === null) {
      throw new BadRequestException(
        'A quantidade mínima de respostas para divulgação dos resultados ainda não foi configurada.',
      );
    }

    const eligibilityRepository = this.dataSource.getRepository(
      EvaluationEligibility,
    );

    const submissionRepository = this.dataSource.getRepository(Submission);

    const answerRepository = this.dataSource.getRepository(Answer);

    const eligibleCount = await eligibilityRepository.count({
      where: {
        evaluation: {
          id: evaluationId,
        },
      },
    });

    const responseCount = await submissionRepository.count({
      where: {
        evaluation: {
          id: evaluationId,
        },
      },
    });

    /*
     * Não disponibiliza resultados enquanto
     * o mínimo de respostas não for atingido.
     */
    if (responseCount < evaluation.minResponsesForResults) {
      throw new BadRequestException(
        `Os resultados ainda não podem ser divulgados. São necessárias pelo menos ${evaluation.minResponsesForResults} respostas.`,
      );
    }

    const answers = await answerRepository.find({
      where: {
        submission: {
          evaluation: {
            id: evaluationId,
          },
        },
      },
      relations: {
        question: true,
      },
    });

    const participationRate =
      eligibleCount > 0
        ? Number(((responseCount / eligibleCount) * 100).toFixed(2))
        : 0;

    const dimensions = evaluation.questionnaire.dimensions
      .sort((a, b) => a.order - b.order)
      .map((dimension) => {
        const questions = dimension.questions
          .sort((a, b) => a.order - b.order)
          .map((question) => {
            const questionAnswers = answers.filter(
              (answer) => answer.question.id === question.id,
            );

            if (question.type === QuestionType.SCALE) {
              const distribution: Record<string, number> = {};

              if (question.scaleMin !== null && question.scaleMax !== null) {
                for (
                  let value = question.scaleMin;
                  value <= question.scaleMax;
                  value++
                ) {
                  distribution[String(value)] = 0;
                }
              }

              const values = questionAnswers
                .map((answer) => answer.scaleValue)
                .filter((value): value is number => value !== null);

              for (const value of values) {
                const key = String(value);

                distribution[key] = (distribution[key] ?? 0) + 1;
              }

              const average =
                values.length > 0
                  ? Number(
                      (
                        values.reduce((sum, value) => sum + value, 0) /
                        values.length
                      ).toFixed(2),
                    )
                  : null;

              return {
                id: question.id,
                text: question.text,
                type: question.type,
                responses: values.length,
                average,
                distribution,
              };
            }

            if (question.type === QuestionType.SINGLE_CHOICE) {
              const distribution: Record<string, number> = {};

              for (const option of question.options ?? []) {
                distribution[option] = 0;
              }

              const values = questionAnswers
                .map((answer) => answer.choiceValue)
                .filter((value): value is string => value !== null);

              for (const value of values) {
                distribution[value] = (distribution[value] ?? 0) + 1;
              }

              return {
                id: question.id,
                text: question.text,
                type: question.type,
                responses: values.length,
                distribution,
              };
            }

            const comments = questionAnswers
              .map((answer) => answer.textValue)
              .filter(
                (value): value is string =>
                  value !== null && value.trim().length > 0,
              );

            return {
              id: question.id,
              text: question.text,
              type: question.type,
              responses: comments.length,
              comments,
            };
          });

        return {
          id: dimension.id,
          name: dimension.name,
          order: dimension.order,
          questions,
        };
      });

    return {
      evaluation: {
        id: evaluation.id,
        discipline: {
          code: evaluation.classGroup.discipline.code,
          name: evaluation.classGroup.discipline.name,
        },
        classGroup: evaluation.classGroup.code,
        academicTerm: evaluation.classGroup.academicTerm.code,
        professor: {
          name: evaluation.classGroup.professor.name,
        },
      },

      participation: {
        eligible: eligibleCount,
        responses: responseCount,
        rate: participationRate,
      },

      minResponsesForResults: evaluation.minResponsesForResults,

      dimensions,
    };
  }
  async updateEvaluationSettings(
    evaluationId: string,
    dto: UpdateEvaluationSettingsDto,
  ) {
    const evaluation = await this.evaluationRepository.findOne({
      where: {
        id: evaluationId,
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    evaluation.minResponsesForResults = dto.minResponsesForResults;

    return this.evaluationRepository.save(evaluation);
  }
}
