import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app-exception';

export function fail(status: number, code: string, message = code): never {
  throw new AppException(status, code, message);
}
export function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) fail(400, 'INVALID_ID');
  return value.toLowerCase();
}
export function integer(value: unknown, field: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) fail(400, 'VALIDATION_ERROR', `${field} must be an integer >= ${minimum}`);
  return Number(value);
}
export function money(value: unknown, field: string) {
  const amount = integer(value, field);
  if (amount > 999999999999) fail(400, 'VALIDATION_ERROR', field + ' exceeds supported VND amount');
  return amount;
}
export function nonempty(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) fail(400, 'VALIDATION_ERROR', `${field} is required (max 255)`);
  return value.trim();
}
@Injectable()
export class CommerceDb {
  private readonly context = new AsyncLocalStorage<EntityManager>();
  constructor(@Inject(DataSource) readonly source: DataSource) {}
  async query(sql: string, params: any[] = []): Promise<any[]> {
    const result = await (this.context.getStore() || this.source.manager).query(sql, params);
    // TypeORM returns [rows, affected] for PostgreSQL UPDATE/DELETE RETURNING.
    return Array.isArray(result?.[0]) && typeof result[1] === 'number' ? result[0] : result;
  }
  get inTransaction() { return Boolean(this.context.getStore()); }
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return work();
    return this.source.transaction(async manager => {
      // Database-wide commerce serialization, including multiple API processes. Optimize
      // to per-customer/product locks only after retaining the race/rollback guarantees.
      await manager.query('SELECT pg_advisory_xact_lock(82731)');
      return this.context.run(manager, work);
    });
  }
  async audit(actor: string, action: string, type: string, id: string) {
    await this.query('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4)', [actor, action, type, id]);
  }
  async event(type: string, aggregateId: string, payload: object, recipients: string[]) {
    const id = randomUUID();
    await this.query("INSERT INTO outbox_events(id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'Commerce',$2,$3,$4)", [id, aggregateId, type, payload]);
    await this.notify(id, type, payload, recipients);
  }
  async notify(id: string, type: string, payload: object, recipients: string[]) {
    for (const userId of new Set(recipients.filter(Boolean))) {
      await this.query(`INSERT INTO notifications(event_id,recipient_user_id,template_key,event_type,title,content,payload)
        VALUES($1,$2,$3::text,$3::text,$3::text,$3::text,$4) ON CONFLICT(event_id,recipient_user_id,template_key) DO NOTHING`, [id, userId, type, payload]);
    }
    // Local in-app delivery is atomic with commerce data; external delivery remains in outbox.
  }
}
