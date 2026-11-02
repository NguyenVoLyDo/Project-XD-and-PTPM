'use client';

import React, { useEffect, useState } from 'react';
import { adminApi } from '@/features/admin/admin.api';
import { AdminAuditLog } from '@/features/admin/types';

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
      {error && <p role="alert">{error} <button onClick={fetchLogs}>Thử lại</button></p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)
          </h1>
          <p className="text-xs text-slate-400">
            Sổ cái bất biến ghi nhận mọi thay đổi trạng thái, xét duyệt và can thiệp nhạy cảm (Đã che giấu PII).
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition flex items-center gap-2 self-start"
        >
          <span>🔄</span>
          <span>Làm mới nhật ký</span>
        </button>
      </div>

      {/* Filter */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
        <input
          type="text"
          placeholder="Lọc theo hành động (ví dụ: USER_LOCKED, PROFILE_APPROVED, DISPUTE_...)"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="w-full sm:w-96 px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <div className="text-xs text-slate-500">
          Hiển thị: <strong>{filteredLogs.length}</strong> bản ghi
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5">Hành động (Action)</th>
                <th className="px-5 py-3.5">Thực thể (Entity)</th>
                <th className="px-5 py-3.5">Người thực hiện (Actor)</th>
                <th className="px-5 py-3.5">Lý do / Ghi chú</th>
                <th className="px-5 py-3.5">Metadata Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Đang tải nhật ký kiểm toán...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Chưa có bản ghi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition text-xs">
                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{log.entityType}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        #{log.entityId?.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                      {log.actorId ? `usr_${log.actorId.slice(0, 8)}***` : 'SYSTEM'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {log.reason || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <code className="px-2 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300 max-w-xs block truncate">
                          {JSON.stringify(log.metadata)}
                        </code>
                      ) : (
                        <span className="text-slate-600">—</span>
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
