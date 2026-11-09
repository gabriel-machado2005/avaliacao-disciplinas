import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AcademicController } from '../academic/academic.controller';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from './roles.guard';

describe('RolesGuard - permissões acadêmicas', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function createContext(
    method: 'deleteCourse' | 'findCourses',
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
});
