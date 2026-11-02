'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { adminApi } from '@/features/admin/admin.api';
import { AdminUser } from '@/features/admin/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(res.items);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, statusFilter, roleFilter]);

  const handleToggleStatus = async () => {
    if (!actionUser) return;
    const newStatus = actionUser.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    startTransition(async () => {
      try {
        await adminApi.updateUserStatus(actionUser.id, newStatus, reason);
        setActionUser(null);
        setReason('');
        await fetchUsers();
      } catch (err: any) {
        alert(err.message || 'Không thể cập nhật trạng thái');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Quản Lý Người Dùng
          </h1>
          <p className="text-xs text-slate-400">
            Xem danh sách tài khoản, kiểm tra vai trò và khóa/mở khóa tài khoản khi cần thiết.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm theo email người dùng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động (ACTIVE)</option>
            <option value="LOCKED">Bị khóa (LOCKED)</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="">Tất cả vai trò</option>
            <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
            <option value="SELLER">Người bán (SELLER)</option>
            <option value="SUPPLIER">Nhà cung cấp (SUPPLIER)</option>
            <option value="ADMIN">Quản trị viên (ADMIN)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Email người dùng</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5">Hồ sơ liên kết</th>
                <th className="px-5 py-3.5">Ngày tham gia</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{u.email}</div>
                      <div className="text-[11px] text-slate-500 font-mono">ID: {u.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r === 'ADMIN'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : r === 'SUPPLIER'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : r === 'SELLER'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                        />
                        {u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {u.supplierProfile && (
                        <div>NCC: {u.supplierProfile.status}</div>
                      )}
                      {u.sellerProfile && (
                        <div>Seller: {u.sellerProfile.status}</div>
                      )}
                      {!u.supplierProfile && !u.sellerProfile && <span>—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setActionUser(u);
                          setReason('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          u.status === 'ACTIVE'
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {actionUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {actionUser.status === 'ACTIVE'
                ? 'Xác nhận khóa tài khoản'
                : 'Xác nhận mở khóa tài khoản'}
            </h3>
            <p className="text-xs text-slate-400">
              Bạn đang thực hiện thao tác trên người dùng: <strong>{actionUser.email}</strong>.
              {actionUser.status === 'ACTIVE' &&
                ' Tài khoản bị khóa sẽ lập tức bị thu hồi toàn bộ phiên đăng nhập hiện tại.'}
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Lý do thực hiện (Audit Log)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Gian lận đơn hàng, Vi phạm chính sách nền tảng..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActionUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition ${
                  actionUser.status === 'ACTIVE'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isPending
                  ? 'Đang xử lý...'
                  : actionUser.status === 'ACTIVE'
                  ? 'Khóa tài khoản'
                  : 'Mở khóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
