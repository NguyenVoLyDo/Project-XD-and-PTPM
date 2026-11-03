'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { adminApi } from '@/features/admin/admin.api';
import { AdminUser } from '@/features/admin/types';
import { Icon } from '@/components/ui/icon';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(res.items);
    } catch (err) {
      console.error('Failed to fetch users', err);
      setError('Không tải được danh sách người dùng. Vui lòng thử lại.');
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
        showToast(`Đã ${newStatus === 'ACTIVE' ? 'mở khóa' : 'khóa'} tài khoản thành công!`);
        await fetchUsers();
      } catch (err: any) {
        showToast(err.message || 'Không thể cập nhật trạng thái', 'error');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-white transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-primary' : 'bg-danger'
          }`}
        >
          <Icon name={toast.type === 'success' ? 'check' : 'alert'} width={18} height={18} />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={fetchUsers} className="underline font-bold">
            Thử lại
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-ink tracking-tight">
            Quản Lý Người Dùng & Phân Quyền
          </h1>
          <p className="text-xs text-subtle mt-0.5">
            Xem danh sách tài khoản, kiểm tra vai trò hoạt động và khóa/mở khóa tài khoản khi có vi phạm.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchUsers}
          className="px-3.5 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-ink text-xs font-semibold transition flex items-center gap-1.5 self-start shadow-xs"
        >
          <Icon name="refresh" width={14} height={14} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row gap-3 shadow-xs">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Tìm kiếm theo email người dùng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-canvas border border-line text-ink placeholder:text-subtle/70 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none">
            <Icon name="search" width={14} height={14} />
          </div>
        </div>

        <div className="flex gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="LOCKED">Đã khóa (LOCKED)</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-subtle uppercase text-[10px] font-bold tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3.5">Email người dùng</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5">Hồ sơ liên kết</th>
                <th className="px-5 py-3.5">Ngày tham gia</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-subtle">
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-subtle">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink">{u.email}</div>
                      <div className="text-[10px] text-subtle font-mono mt-0.5">ID: {u.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              r === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : r === 'SUPPLIER'
                                ? 'bg-info-soft text-info border border-info/20'
                                : r === 'SELLER'
                                ? 'bg-success-soft text-success border border-success/20'
                                : 'bg-canvas text-subtle border-line'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          u.status === 'ACTIVE'
                            ? 'bg-success-soft text-success border border-success/25'
                            : 'bg-danger-soft text-danger border border-danger/25'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'
                          }`}
                        />
                        {u.status === 'ACTIVE' ? 'Hoạt động' : 'Bị khóa'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-subtle">
                      {u.supplierProfile && (
                        <div className="text-[11px]">NCC: <strong className="text-ink">{u.supplierProfile.status}</strong></div>
                      )}
                      {u.sellerProfile && (
                        <div className="text-[11px]">Seller: <strong className="text-ink">{u.sellerProfile.status}</strong></div>
                      )}
                      {!u.supplierProfile && !u.sellerProfile && <span className="text-subtle/60">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-subtle">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActionUser(u);
                          setReason('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          u.status === 'ACTIVE'
                            ? 'bg-danger-soft hover:bg-danger/10 text-danger border-danger/30'
                            : 'bg-success-soft hover:bg-success/10 text-success border border-success/30'
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

      {/* Confirmation Modal - Clean Minimalist */}
      {actionUser && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-line rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  actionUser.status === 'ACTIVE'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}
              >
                <Icon name={actionUser.status === 'ACTIVE' ? 'lock' : 'unlock'} width={20} height={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">
                  {actionUser.status === 'ACTIVE'
                    ? 'Xác nhận khóa tài khoản'
                    : 'Xác nhận mở khóa tài khoản'}
                </h3>
                <p className="text-xs text-subtle truncate max-w-xs">{actionUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-subtle leading-relaxed">
              {actionUser.status === 'ACTIVE'
                ? 'Tài khoản sau khi bị khóa sẽ lập tức mất quyền truy cập và bị thu hồi toàn bộ phiên đăng nhập hiện tại.'
                : 'Mở khóa tài khoản sẽ cho phép người dùng tiếp tục đăng nhập và thực hiện các giao dịch trên hệ thống.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Lý do thực hiện (Lưu vào Nhật ký kiểm toán)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Gian lận đơn hàng, Vi phạm chính sách nền tảng..."
                className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink placeholder:text-subtle/70 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActionUser(null)}
                className="px-4 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-subtle hover:text-ink text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition ${
                  actionUser.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-primary hover:bg-primary-hover text-on-primary'
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
