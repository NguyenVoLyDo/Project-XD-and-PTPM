'use client';

import React, { useEffect, useState } from 'react';
import { adminApi } from '@/features/admin/admin.api';
import { AdminAuditLog } from '@/features/admin/types';
import { Icon } from '@/components/ui/icon';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getAuditLogs(100);
      setLogs(res);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
      setError('Không tải được nhật ký. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = filterAction
    ? logs.filter((l) => l.action.toLowerCase().includes(filterAction.toLowerCase()))
    : logs;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={fetchLogs} className="underline font-bold">
            Thử lại
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-ink tracking-tight">
            Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)
          </h1>
          <p className="text-xs text-subtle mt-0.5">
            Sổ cái bất biến ghi nhận mọi can thiệp phân quyền, xét duyệt đối tác và thao tác nhạy cảm (Đã che giấu PII).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          className="px-3.5 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-ink text-xs font-semibold transition flex items-center gap-1.5 self-start shadow-xs"
        >
          <Icon name="refresh" width={14} height={14} />
          <span>Làm mới nhật ký</span>
        </button>
      </div>

      {/* Filter */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="w-full sm:w-96 relative">
          <input
            type="text"
            placeholder="Lọc theo hành động (USER_LOCKED, PROFILE_APPROVED...)"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-canvas border border-line text-xs text-ink placeholder:text-subtle/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none">
            <Icon name="search" width={14} height={14} />
          </div>
        </div>
        <div className="text-xs text-subtle font-medium">
          Hiển thị: <strong className="text-ink">{filteredLogs.length}</strong> bản ghi gần nhất
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-subtle uppercase text-[10px] font-bold tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5">Hành động (Action)</th>
                <th className="px-5 py-3.5">Thực thể (Entity)</th>
                <th className="px-5 py-3.5">Người thực hiện (Actor)</th>
                <th className="px-5 py-3.5">Lý do / Ghi chú</th>
                <th className="px-5 py-3.5">Metadata Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-subtle">
                    Đang tải nhật ký kiểm toán...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-subtle">
                    Chưa có bản ghi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/40 transition">
                    <td className="px-5 py-3.5 text-subtle whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-canvas text-ink border border-line">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink">{log.entityType}</div>
                      <div className="text-[10px] text-subtle font-mono mt-0.5">
                        #{log.entityId?.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-subtle">
                      {log.actorId ? `usr_${log.actorId.slice(0, 8)}***` : 'SYSTEM'}
                    </td>
                    <td className="px-5 py-3.5 text-subtle">
                      {log.reason || <span className="text-subtle/50">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <code className="px-2 py-1 rounded-md bg-canvas border border-line text-[10px] font-mono text-subtle max-w-xs block truncate">
                          {JSON.stringify(log.metadata)}
                        </code>
                      ) : (
                        <span className="text-subtle/50">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
