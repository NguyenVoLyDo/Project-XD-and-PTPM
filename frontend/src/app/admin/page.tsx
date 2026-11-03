'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/features/admin/admin.api';
import { AdminAuditLog, AdminProfile, AdminUser } from '@/features/admin/types';
import { Icon } from '@/components/ui/icon';

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
          adminApi.getUsers({ status: 'LOCKED', limit: 1 }),
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()} className="underline font-bold">
            Thử lại
          </button>
        </div>
      )}

      {/* Header Banner - Clean Minimalist */}
      <div className="p-6 rounded-2xl bg-surface border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
            Bảng điều khiển hệ thống
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight mt-0.5">
            Tổng quan Vận hành DropConnect
          </h1>
          <p className="text-xs text-subtle mt-1 max-w-2xl leading-relaxed">
            Giám sát tài khoản người dùng, xét duyệt đối tác Nhà cung cấp & Người bán, và đối soát nhật ký kiểm toán.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/admin/profiles"
            className="px-3.5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-hover text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
          >
            <Icon name="clipboard" width={14} height={14} />
            <span>Xét duyệt hồ sơ ({pendingCount})</span>
          </Link>
          <Link
            href="/admin/users"
            className="px-3.5 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-ink text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Icon name="users" width={14} height={14} />
            <span>Người dùng</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Tổng người dùng',
            value: totalUsers,
            desc: 'Tài khoản đã đăng ký',
            icon: 'users' as const,
            link: '/admin/users',
            badge: null,
          },
          {
            title: 'Hồ sơ chờ duyệt',
            value: pendingCount,
            desc: 'Supplier & Seller mới',
            icon: 'clipboard' as const,
            link: '/admin/profiles',
            badge: pendingCount > 0 ? `${pendingCount} cần duyệt` : null,
            badgeStyle: 'bg-warning-soft text-warning border-warning/30',
          },
          {
            title: 'Tài khoản bị khóa',
            value: lockedCount,
            desc: 'Đã tạm dừng truy cập',
            icon: 'lock' as const,
            link: '/admin/users?status=LOCKED',
            badge: lockedCount > 0 ? `${lockedCount} tài khoản` : null,
            badgeStyle: 'bg-danger-soft text-danger border-danger/30',
          },
          {
            title: 'Nhật ký kiểm toán',
            value: auditLogs.length,
            desc: 'Bản ghi hệ thống gần đây',
            icon: 'shield' as const,
            link: '/admin/audit',
            badge: null,
          },
        ].map((kpi, idx) => (
          <Link
            key={idx}
            href={kpi.link}
            className="p-5 rounded-2xl bg-surface border border-line hover:border-primary/40 hover:shadow-sm transition group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">
                {kpi.title}
              </span>
              <div className="w-8 h-8 rounded-xl bg-canvas border border-line group-hover:bg-primary-soft group-hover:text-primary transition flex items-center justify-center text-subtle">
                <Icon name={kpi.icon} width={16} height={16} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-ink flex items-baseline gap-2">
                {loading ? '...' : kpi.value}
                {kpi.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kpi.badgeStyle}`}>
                    {kpi.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-subtle">{kpi.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Grid: Pending Profiles & Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Profiles Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-line flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <h2 className="text-sm font-bold text-ink">Hồ sơ chờ xét duyệt</h2>
              <p className="text-xs text-subtle">Đối tác mới đăng ký cần kích hoạt quyền</p>
            </div>
            <Link
              href="/admin/profiles"
              className="text-xs font-semibold text-primary hover:underline transition"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-2 flex-1 divide-y divide-line">
            {profiles.filter((p) => p.status === 'PENDING').slice(0, 4).length === 0 ? (
              <div className="py-8 text-center text-subtle text-xs">
                Hiện không có hồ sơ nào đang chờ duyệt.
              </div>
            ) : (
              profiles
                .filter((p) => p.status === 'PENDING')
                .slice(0, 4)
                .map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.role === 'SUPPLIER'
                              ? 'bg-info-soft text-info border border-info/20'
                              : 'bg-success-soft text-success border border-success/20'
                          }`}
                        >
                          {p.role}
                        </span>
                        <span className="text-[11px] text-subtle truncate">{p.email}</span>
                      </div>
                    </div>
                    <Link
                      href="/admin/profiles"
                      className="px-2.5 py-1.5 rounded-lg bg-primary-soft text-primary hover:bg-primary hover:text-on-primary text-xs font-semibold transition"
                    >
                      Xét duyệt
                    </Link>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Audit Logs Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-line flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <h2 className="text-sm font-bold text-ink">Hoạt động kiểm toán gần nhất</h2>
              <p className="text-xs text-subtle">Sổ cái bất biến ghi nhận mọi can thiệp nhạy cảm</p>
            </div>
            <Link
              href="/admin/audit"
              className="text-xs font-semibold text-primary hover:underline transition"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-2 flex-1 divide-y divide-line">
            {auditLogs.slice(0, 4).length === 0 ? (
              <div className="py-8 text-center text-subtle text-xs">
                Chưa có bản ghi kiểm toán nào.
              </div>
            ) : (
              auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-canvas text-ink border border-line">
                        {log.action}
                      </span>
                      <span className="text-xs text-subtle truncate">
                        {log.entityType} #{log.entityId.slice(0, 8)}...
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-subtle mt-1 truncate">Lý do: {log.reason}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-subtle whitespace-nowrap">
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
