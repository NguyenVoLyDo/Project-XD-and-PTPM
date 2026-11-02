'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { adminApi } from '@/features/admin/admin.api';
import { AdminProfile } from '@/features/admin/types';

export default function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SUPPLIER' | 'SELLER'>('ALL');
  const [selectedProfile, setSelectedProfile] = useState<AdminProfile | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reasonCode, setReasonCode] = useState('KYC_VERIFIED');
  const [isPending, startTransition] = useTransition();

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const role = roleFilter === 'ALL' ? undefined : roleFilter;
      const status = tab === 'ALL' ? undefined : tab;
      const res = await adminApi.getProfiles(role, status);
      setProfiles(res);
    } catch (err) {
      console.error('Failed to fetch profiles', err);
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
        setSelectedProfile(null);
        await fetchProfiles();
      } catch (err: any) {
        alert(err.message || 'Không thể ghi nhận quyết định');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Xét Duyệt Hồ Sơ Supplier & Seller
        </h1>
        <p className="text-xs text-slate-400">
          Phê duyệt hoặc từ chối hồ sơ đăng ký kinh doanh trước khi đối tác được tạo Sản phẩm/Listing.
        </p>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'PENDING' as const, label: 'Chờ duyệt (PENDING)' },
            { id: 'APPROVED' as const, label: 'Đã duyệt (APPROVED)' },
            { id: 'REJECTED' as const, label: 'Bị từ chối (REJECTED)' },
            { id: 'ALL' as const, label: 'Tất cả hồ sơ' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                tab === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="SUPPLIER">Nhà cung cấp (SUPPLIER)</option>
            <option value="SELLER">Người bán (SELLER)</option>
          </select>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Tên đơn vị / Gian hàng</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Email liên hệ</th>
                <th className="px-5 py-3.5">Trạng thái duyệt</th>
                <th className="px-5 py-3.5">Ngày nộp hồ sơ</th>
                <th className="px-5 py-3.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Đang tải danh sách hồ sơ...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Không có hồ sơ nào trong mục này.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ProfileID: {p.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.role === 'SUPPLIER'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{p.email}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : p.status === 'REJECTED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'APPROVED'
                              ? 'bg-emerald-400'
                              : p.status === 'REJECTED'
                              ? 'bg-red-400'
                              : 'bg-amber-400 animate-pulse'
                          }`}
                        />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedProfile(p);
                              setDecision('APPROVED');
                              setReasonCode('KYC_VERIFIED');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold transition"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProfile(p);
                              setDecision('REJECTED');
                              setReasonCode('INCOMPLETE_DOCS');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold transition"
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Đã quyết định</span>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {decision === 'APPROVED' ? 'Phê duyệt hồ sơ' : 'Từ chối hồ sơ'}
            </h3>
            <p className="text-xs text-slate-400">
              Đơn vị: <strong>{selectedProfile.name}</strong> ({selectedProfile.role})
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Mã lý do (reasonCode per admin.md)
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {decision === 'APPROVED' ? (
                  <>
                    <option value="KYC_VERIFIED">KYC_VERIFIED (Đầy đủ giấy tờ pháp lý)</option>
                    <option value="BUSINESS_VERIFIED">BUSINESS_VERIFIED (Kho/Gian hàng đạt chuẩn)</option>
                    <option value="SPECIAL_APPROVAL">SPECIAL_APPROVAL (Đối tác ưu tiên)</option>
                  </>
                ) : (
                  <>
                    <option value="INCOMPLETE_DOCS">INCOMPLETE_DOCS (Hồ sơ thiếu thông tin)</option>
                    <option value="SUSPICIOUS_IDENTITY">SUSPICIOUS_IDENTITY (Nghi vấn thông tin giả mạo)</option>
                    <option value="POLICY_VIOLATION">POLICY_VIOLATION (Không đáp ứng tiêu chuẩn sàn)</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDecision}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition ${
                  decision === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {isPending ? 'Đang lưu...' : decision === 'APPROVED' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
