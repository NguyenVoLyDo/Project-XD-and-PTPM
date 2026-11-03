'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { adminApi } from '@/features/admin/admin.api';
import { AdminProfile } from '@/features/admin/types';
import { Icon } from '@/components/ui/icon';

export default function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SUPPLIER' | 'SELLER'>('ALL');
  const [selectedProfile, setSelectedProfile] = useState<AdminProfile | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reasonCode, setReasonCode] = useState('KYC_VERIFIED');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError('');
      const role = roleFilter === 'ALL' ? undefined : roleFilter;
      const status = tab === 'ALL' ? undefined : tab;
      const res = await adminApi.getProfiles(role, status);
      setProfiles(res);
    } catch (err) {
      console.error('Failed to fetch profiles', err);
      setError('Không tải được hồ sơ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [tab, roleFilter]);

  const handleDecision = async () => {
    if (!selectedProfile) return;
    startTransition(async () => {
      try {
        await adminApi.decideProfile(
          selectedProfile.id,
          decision,
          reasonCode,
          selectedProfile.role,
        );
        const actionLabel = decision === 'APPROVED' ? 'Phê duyệt' : 'Từ chối';
        setSelectedProfile(null);
        showToast(`${actionLabel} hồ sơ của ${selectedProfile.name} thành công!`);
        await fetchProfiles();
      } catch (err: any) {
        showToast(err.message || 'Không thể ghi nhận quyết định', 'error');
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
          <button type="button" onClick={fetchProfiles} className="underline font-bold">
            Thử lại
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-ink tracking-tight">
            Xét Duyệt Hồ Sơ Đối Tác (Supplier & Seller)
          </h1>
          <p className="text-xs text-subtle mt-0.5">
            Xác minh thông tin doanh nghiệp, giấy phép kinh doanh trước khi đối tác được phép cấp nguồn hoặc mở gian hàng.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchProfiles}
          className="px-3.5 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-ink text-xs font-semibold transition flex items-center gap-1.5 self-start shadow-xs"
        >
          <Icon name="refresh" width={14} height={14} />
          <span>Làm mới hồ sơ</span>
        </button>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-surface border border-line rounded-2xl shadow-xs">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'PENDING' as const, label: 'Chờ duyệt' },
            { id: 'APPROVED' as const, label: 'Đã duyệt' },
            { id: 'REJECTED' as const, label: 'Bị từ chối' },
            { id: 'ALL' as const, label: 'Tất cả hồ sơ' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                tab === item.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-subtle hover:text-ink hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="px-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="h-9 px-3 rounded-xl bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="SUPPLIER">Nhà cung cấp (SUPPLIER)</option>
            <option value="SELLER">Người bán (SELLER)</option>
          </select>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-subtle uppercase text-[10px] font-bold tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3.5">Tên đơn vị / Gian hàng</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Email liên hệ</th>
                <th className="px-5 py-3.5">Trạng thái duyệt</th>
                <th className="px-5 py-3.5">Ngày nộp hồ sơ</th>
                <th className="px-5 py-3.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-subtle">
                    Đang tải danh sách hồ sơ...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-subtle">
                    Không có hồ sơ nào trong mục này.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink">{p.name}</div>
                      <div className="text-[10px] text-subtle font-mono mt-0.5">
                        ProfileID: {p.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          p.role === 'SUPPLIER'
                            ? 'bg-info-soft text-info border border-info/20'
                            : 'bg-success-soft text-success border border-success/20'
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-subtle">{p.email}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          p.status === 'APPROVED'
                            ? 'bg-success-soft text-success border border-success/25'
                            : p.status === 'REJECTED'
                            ? 'bg-danger-soft text-danger border border-danger/25'
                            : 'bg-warning-soft text-warning border border-warning/25'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'APPROVED'
                              ? 'bg-success'
                              : p.status === 'REJECTED'
                              ? 'bg-danger'
                              : 'bg-warning animate-pulse'
                          }`}
                        />
                        {p.status === 'APPROVED' ? 'Đã duyệt' : p.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-subtle">
                      {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProfile(p);
                              setDecision('APPROVED');
                              setReasonCode('KYC_VERIFIED');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-success-soft hover:bg-success/15 text-success border border-success/30 text-xs font-semibold transition"
                          >
                            Phê duyệt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProfile(p);
                              setDecision('REJECTED');
                              setReasonCode('INCOMPLETE_DOCS');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-danger-soft hover:bg-danger/15 text-danger border border-danger/30 text-xs font-semibold transition"
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="text-subtle/70 text-xs italic">Đã xử lý</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-line rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  decision === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                }`}
              >
                <Icon name={decision === 'APPROVED' ? 'check' : 'alert'} width={20} height={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">
                  {decision === 'APPROVED' ? 'Xác nhận Phê duyệt hồ sơ' : 'Xác nhận Từ chối hồ sơ'}
                </h3>
                <p className="text-xs text-subtle truncate max-w-xs">{selectedProfile.name}</p>
              </div>
            </div>

            <p className="text-xs text-subtle leading-relaxed">
              Bạn đang quyết định hồ sơ vai trò{' '}
              <strong className="text-ink">{selectedProfile.role}</strong> của{' '}
              <strong className="text-ink">{selectedProfile.email}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Mã lý do / Căn cứ quyết định
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {decision === 'APPROVED' ? (
                  <>
                    <option value="KYC_VERIFIED">KYC_VERIFIED — Đầy đủ giấy phép & tài khoản định danh</option>
                    <option value="FAST_TRACK">FAST_TRACK — Đối tác ưu tiên từ chương trình vườn ươm</option>
                  </>
                ) : (
                  <>
                    <option value="INCOMPLETE_DOCS">INCOMPLETE_DOCS — Thiếu giấy phép hoặc thông tin mờ</option>
                    <option value="SUSPICIOUS_IDENTITY">SUSPICIOUS_IDENTITY — Nghi vấn thông tin giả mạo</option>
                    <option value="POLICY_VIOLATION">POLICY_VIOLATION — Vi phạm danh mục ngành hàng cấm</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="px-4 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-subtle hover:text-ink text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDecision}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition ${
                  decision === 'APPROVED'
                    ? 'bg-primary hover:bg-primary-hover text-on-primary'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isPending
                  ? 'Đang lưu...'
                  : decision === 'APPROVED'
                  ? 'Xác nhận Phê duyệt'
                  : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
