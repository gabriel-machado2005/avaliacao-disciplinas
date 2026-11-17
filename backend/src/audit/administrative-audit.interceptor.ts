import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserRole } from '../users/entities/user.entity';
import { auditActor } from './administrative-audit';

@Injectable()
export class AdministrativeAuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const { method, user } = context.switchToHttp().getRequest<{
      method: string;
      user?: { userId: string; role: UserRole };
    }>();
    if (
      (user?.role !== UserRole.ADMIN && user?.role !== UserRole.COORDINATOR) ||
      !['POST', 'PATCH', 'DELETE'].includes(method)
    ) {
      return next.handle();
    }

    return new Observable((subscriber) =>
      auditActor.run(user.userId, () => next.handle().subscribe(subscriber)),
    );
  }
}
