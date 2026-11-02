'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/features/admin/admin.api';
import { AdminAuditLog, AdminProfile, AdminUser } from '@/features/admin/types';

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [usersRes, profilesRes, auditRes, lockedRes] = await Promise.all([
          adminApi.getUsers({ limit: 10 }),
          adminApi.getProfiles(),
          adminApi.getAuditLogs(10),
          adminApi.getUsers({status:'LOCKED',limit:1}),
        ]);
        setUsers(usersRes.items);
        setTotalUsers(usersRes.total);
        setLockedCount(lockedRes.total);
        setProfiles(profilesRes);
        setAuditLogs(auditRes);
      } catch (err) {
        console.error('Failed to load admin dashboard data', err);
        setError('Không tải được dữ liệu quản trị. Vui lòng tải lại trang.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const pendingCount = profiles.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {error && <p role="alert">{error}</p>}
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bảng điều khiển Quản Trị Hệ Thống
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Giám sát người dùng, xét duyệt hồ sơ Supplier & Seller và theo dõi nhật ký kiểm toán.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Tổng người dùng',
            value: totalUsers,
            desc: 'Tài khoản trên hệ thống',
            icon: '👥',
            color: 'from-blue-600 to-indigo-600',
            link: '/admin/users',
          },
          {
            title: 'Hồ sơ chờ duyệt',
            value: pendingCount,
            desc: 'Supplier / Seller mới',
            icon: '📋',
            color: 'from-amber-500 to-orange-600',
            link: '/admin/profiles',
            highlight: pendingCount > 0,
          },
          {
            title: 'Tài khoản bị khóa',
            value: lockedCount,
            desc: 'Đã chặn truy cập',
            icon: '🔒',
            color: 'from-red-600 to-rose-600',
            link: '/admin/users?status=LOCKED',
          },
          {
            title: 'Nhật ký kiểm toán',
            value: auditLogs.length,
            desc: 'Bản ghi gần nhất',
            icon: '🛡️',
            color: 'from-emerald-600 to-teal-600',
            link: '/admin/audit',
          },
        ].map((kpi, idx) => (
          <Link
            key={idx}
            href={kpi.link}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-sm hover:shadow-md group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {kpi.title}
              </span>
              <span className="text-xl p-2 rounded-xl bg-slate-800/80 group-hover:scale-110 transition-transform">
                {kpi.icon}
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white flex items-baseline gap-2">
                {loading ? '...' : kpi.value}
                {kpi.highlight && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Cần duyệt
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">{kpi.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Grid: Pending Profiles & Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Profiles Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">Hồ sơ chờ xét duyệt</h2>
              <p className="text-xs text-slate-400">Các hồ sơ đang chờ Admin phê duyệt</p>
            </div>
            <Link
              href="/admin/profiles"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-4 flex-1 divide-y divide-slate-800/60">
            {profiles.filter((p) => p.status === 'PENDING').slice(0, 4).length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                🎉 Không có hồ sơ nào đang chờ duyệt.
              </div>
            ) : (
              profiles
                .filter((p) => p.status === 'PENDING')
                .slice(0, 4)
                .map((p) => (
                  <div key={p.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.role === 'SUPPLIER'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {p.role}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{p.email}</span>
                      </div>
                    </div>
                    <Link
                      href="/admin/profiles"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition"
                    >
                      Xét duyệt
                    </Link>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Audit Logs Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">Hoạt động kiểm toán gần nhất</h2>
              <p className="text-xs text-slate-400">Nhật ký bất biến ghi nhận mọi thay đổi nhạy cảm</p>
            </div>
            <Link
              href="/admin/audit"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-4 flex-1 divide-y divide-slate-800/60">
            {auditLogs.slice(0, 4).length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                Chưa có bản ghi kiểm toán nào.
              </div>
            ) : (
              auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                        {log.action}
                      </span>
                      <span className="text-xs text-slate-400">
                        {log.entityType} #{log.entityId.slice(0, 8)}...
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-slate-400 mt-1">Lý do: {log.reason}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
