import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';
import {
  AdministrativeAuditEvent,
  type AuditAction,
  type AuditResource,
} from './administrative-audit.entity';

export const auditActor = new AsyncLocalStorage<string>();

export async function recordAudit(
  manager: EntityManager,
  action: AuditAction,
  resourceType: AuditResource,
  resourceId: string,
) {
  const actorId = auditActor.getStore();
  if (actorId) {
    await manager.insert(AdministrativeAuditEvent, {
      actorId,
      action,
      resourceType,
      resourceId,
    });
  }
}

// Services with their own transaction call recordAudit directly.
export function auditedWrite<Entity extends ObjectLiteral, Result>(
  repository: Repository<Entity>,
  action: AuditAction,
  resourceType: AuditResource,
  write: (transactionRepository: Repository<Entity>) => Promise<Result>,
  resourceId: (result: Result) => string | undefined,
): Promise<Result> {
  if (!auditActor.getStore()) {
    // Internal calls without an authenticated administrative request, such as bootstrap.
    return write(repository);
  }

  return repository.manager.transaction(async (manager) => {
    const result = await write(manager.getRepository(repository.target));
    const id = resourceId(result);
    if (id !== undefined) {
      await recordAudit(manager, action, resourceType, id);
    }
    return result;
  });
}

export function auditSave<Entity extends { id: string }>(
  repository: Repository<Entity>,
  entity: Entity,
  action: AuditAction,
  resourceType: AuditResource,
  id?: string,
) {
  return auditedWrite(
    repository,
    action,
    resourceType,
    (repo) => repo.save(entity),
    (saved) => id ?? saved.id,
  );
}

export function auditDelete<Entity extends ObjectLiteral>(
  repository: Repository<Entity>,
  resourceType: AuditResource,
  id: string,
) {
  return auditedWrite(
    repository,
    'DELETE',
    resourceType,
    (repo) => repo.delete(id),
    (result) => (result.affected ? id : undefined),
  );
}
