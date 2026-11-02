'use client';

import { useEffect, useState, useMemo } from 'react';
import { ApiClient } from '../../lib/api';
import { useAuth } from '../../features/auth/hooks/use-auth';
import Link from 'next/link';
import { Icon } from '../../components/ui/icon';
import { Button } from '../../components/ui/button';

type Notice = {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<Notice[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setError('');
      const result = await ApiClient.get<{ items: Notice[] }>('/notifications');
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách thông báo');
    }
  };

  useEffect(() => {
    if (user) void load();
  }, [user?.userId]);

  const markAsRead = async (id: string) => {
    try {
      setUpdatingId(id);
      await ApiClient.post(`/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === 'UNREAD') return items.filter((i) => !i.isRead);
    return items;
  }, [items, filter]);

  const unreadCount = items.filter((i) => !i.isRead).length;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse border border-line" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center bg-surface border border-line rounded-3xl p-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center">
          <Icon name="user" width={24} height={24} />
        </div>
        <h2 className="text-xl font-bold text-ink">Đăng nhập để xem thông báo</h2>
        <p className="text-xs text-subtle">
          Theo dõi tiến trình đơn hàng, cảnh báo giá bán và thông tin cập nhật tài khoản.
        </p>
        <Link href="/login" className="button-link inline-flex">
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight flex items-center gap-2.5">
            <span>Trung tâm thông báo</span>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 border border-rose-500/25">
                {unreadCount} chưa đọc
              </span>
            )}
          </h1>
          <p className="text-xs text-subtle mt-1">
            Thông tin cập nhật đơn hàng, vận đơn và biến động chính sách sàn.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-subtle hover:text-ink hover:bg-muted border border-line'
            }`}
          >
            Tất cả ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNREAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'UNREAD'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-subtle hover:text-ink hover:bg-muted border border-line'
            }`}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={load} className="underline font-bold">Thử lại</button>
        </div>
      )}

      {/* Notifications list */}
      {filteredItems.length === 0 ? (
        <div className="py-20 text-center bg-surface border border-line rounded-3xl">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-3">
            <Icon name="check" width={24} height={24} />
          </div>
          <h3 className="text-base font-bold text-ink">Không có thông báo mới</h3>
          <p className="text-xs text-subtle mt-1">
            {filter === 'UNREAD' ? 'Bạn đã đọc toàn bộ các thông báo.' : 'Hệ thống chưa có thông báo mới nào dành cho bạn.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                item.isRead
                  ? 'bg-surface border-line text-subtle'
                  : 'bg-primary-soft/40 border-primary/30 text-ink shadow-xs'
              }`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  <h2 className="font-bold text-sm text-ink">{item.title}</h2>
                </div>
                <p className="text-xs text-subtle leading-relaxed">{item.content}</p>
                <time className="text-[11px] text-subtle/80 block pt-1 font-mono">
                  {new Date(item.createdAt).toLocaleString('vi-VN')}
                </time>
              </div>

              {!item.isRead && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAsRead(item.id)}
                  isLoading={updatingId === item.id}
                  className="shrink-0 text-xs font-semibold"
                >
                  Đã đọc
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
