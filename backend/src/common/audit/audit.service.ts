import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity.js';

export interface RecordAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(params: RecordAuditParams): Promise<AuditLog> {
    const entry = this.auditRepo.create({
      actorId: params.actorId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      reason: params.reason || null,
      metadata: params.metadata || null,
    });

    const saved = await this.auditRepo.save(entry);
    this.logger.log(`Audit recorded: action=${entry.action} entity=${entry.entityType}:${entry.entityId} actor=${entry.actorId}`);
    return saved;
  }

  async findRecent(limit = 50, cursor?: string): Promise<AuditLog[]> {
    const qb = this.auditRepo.createQueryBuilder('audit').orderBy('audit.createdAt', 'DESC').take(limit);
    if (cursor) {
      qb.where('audit.createdAt < :cursor', { cursor });
    }
    return qb.getMany();
  }
}
