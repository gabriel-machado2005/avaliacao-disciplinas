import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AcademicController } from '../academic/academic.controller';
import { EvaluationsController } from '../evaluations/evaluations.controller';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from './roles.guard';

describe('RolesGuard - permissões acadêmicas', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function createContext(
    method:
      | 'deleteCourse'
      | 'deleteDiscipline'
      | 'deleteAcademicTerm'
      | 'deleteClassGroup'
      | 'findCourses',
    role: UserRole,
  ): ExecutionContext {
    return {
      getHandler: () => AcademicController.prototype[method],
      getClass: () => AcademicController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  function createEvaluationContext(
    method:
      'deletePeriod' | 'findPeriods' | 'deleteEvaluation' | 'updateEvaluation',
    role: UserRole,
  ): ExecutionContext {
    return {
      getHandler: () => EvaluationsController.prototype[method],
      getClass: () => EvaluationsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('deve permitir que um administrador exclua cursos', () => {
    const context = createContext('deleteCourse', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um coordenador exclua cursos', () => {
    const context = createContext('deleteCourse', UserRole.COORDINATOR);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um coordenador consulte cursos', () => {
    const context = createContext('findCourses', UserRole.COORDINATOR);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um estudante consulte cursos pelo módulo administrativo', () => {
    const context = createContext('findCourses', UserRole.STUDENT);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um administrador exclua disciplinas', () => {
    const context = createContext('deleteDiscipline', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um coordenador exclua disciplinas', () => {
    const context = createContext('deleteDiscipline', UserRole.COORDINATOR);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um administrador exclua períodos letivos', () => {
    const context = createContext('deleteAcademicTerm', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um coordenador exclua períodos letivos', () => {
    const context = createContext('deleteAcademicTerm', UserRole.COORDINATOR);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um administrador exclua turmas', () => {
    const context = createContext('deleteClassGroup', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um coordenador exclua turmas', () => {
    const context = createContext('deleteClassGroup', UserRole.COORDINATOR);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um administrador exclua períodos de avaliação', () => {
    const context = createEvaluationContext('deletePeriod', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um coordenador exclua períodos de avaliação', () => {
    const context = createEvaluationContext(
      'deletePeriod',
      UserRole.COORDINATOR,
    );

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um coordenador consulte períodos de avaliação', () => {
    const context = createEvaluationContext(
      'findPeriods',
      UserRole.COORDINATOR,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um estudante consulte períodos pelo módulo administrativo', () => {
    const context = createEvaluationContext('findPeriods', UserRole.STUDENT);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um administrador exclua avaliações', () => {
    const context = createEvaluationContext('deleteEvaluation', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um coordenador exclua avaliações', () => {
    const context = createEvaluationContext(
      'deleteEvaluation',
      UserRole.COORDINATOR,
    );

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve permitir que um administrador edite avaliações', () => {
    const context = createEvaluationContext('updateEvaluation', UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve permitir que um coordenador edite avaliações', () => {
    const context = createEvaluationContext(
      'updateEvaluation',
      UserRole.COORDINATOR,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve impedir que um professor edite avaliações', () => {
    const context = createEvaluationContext(
      'updateEvaluation',
      UserRole.PROFESSOR,
    );

    expect(guard.canActivate(context)).toBe(false);
  });

  it('deve impedir que um estudante edite avaliações', () => {
    const context = createEvaluationContext(
      'updateEvaluation',
      UserRole.STUDENT,
    );

    expect(guard.canActivate(context)).toBe(false);
  });
});
