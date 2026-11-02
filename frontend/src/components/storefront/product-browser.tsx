'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiClient } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { ListingCard, type ListingCardItem } from '../organisms/catalog/listing-card';
import { Icon } from '../ui/icon';
import { Button } from '../ui/button';
import { LoginModal } from '../modals/login-modal';

export function ProductBrowser({ featured = false }: { featured?: boolean }) {
  const params = useSearchParams();
  const search = featured ? '' : params.get('q') || '';
  const supplier = featured ? '' : params.get('supplier') || '';
  const sort = featured ? '' : params.get('sort') || '';
  const page = featured ? 1 : Math.max(1, Number(params.get('page')) || 1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [suppliers, setSuppliers] = useState<Array<[string, string]>>([]);
  const [items, setItems] = useState<ListingCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; success: boolean } | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<ListingCardItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const { currentUser, refreshCartCount } = useAuth();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    ApiClient.get<{ items: ListingCardItem[]; total: number; totalPages: number; suppliers: Array<{id: string; name: string}> }>('/listings/page', {
      page, limit: featured ? 3 : 24, search: search || undefined, supplierId: supplier || undefined, sort: sort || undefined,
    })
      .then((data) => {
        if (active) {
          setItems(data.items);
          setTotal(data.total);
          setTotalPages(data.totalPages);
          setSuppliers(data.suppliers.map(s => [s.id, s.name]));
        }
      })
      .catch(() => {
        if (active) setError('Chưa tải được sản phẩm. Kiểm tra kết nối và thử lại.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, page, featured, search, supplier, sort]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (key !== 'page') next.delete('page');
    if (value) next.set(key, value);
    else next.delete(key);
    window.history.replaceState(null, '', '/catalog' + (next.size ? '?' + next.toString() : ''));
  };

  const shown = items;

  const add = async (item: ListingCardItem) => {
    if (busy.current) return;
    if (timer.current) clearTimeout(timer.current);
    if (!currentUser.id) {
      setPendingItem(item);
      setLoginModalOpen(true);
      return;
    }
    if (currentUser.role !== 'CUSTOMER') {
      setNotice({ text: 'Tài khoản hiện tại không phải Khách hàng. Vui lòng chuyển vai trò sang Khách hàng để mua sắm.', success: false });
      timer.current = setTimeout(() => setNotice(null), 5000);
      return;
    }
    busy.current = true;
    setAdding(item.id);
    try {
      const cart = await ApiClient.get<{ items: Array<{ listingId: string; quantity: number }> }>('/cart');
      const quantity = (cart.items.find((line) => line.listingId === item.id)?.quantity || 0) + 1;
      await ApiClient.put('/cart/items/' + encodeURIComponent(item.id), { quantity });
      await refreshCartCount();
      setNotice({ text: `Đã thêm "${item.productName}" vào giỏ hàng.`, success: true });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : 'Chưa thêm được sản phẩm. Vui lòng thử lại.',
        success: false,
      });
    } finally {
      setAdding(null);
      busy.current = false;
      timer.current = setTimeout(() => setNotice(null), 5000);
    }
  };

  return (
    <div>
      {!featured && (
        <div className="bg-surface border border-line rounded-3xl p-5 mb-8 space-y-4 shadow-xs">
          {/* Top row: search & supplier dropdown */}
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="relative">
              <Icon name="search" className="absolute top-1/2 -translate-y-1/2 left-3.5 text-subtle" width={18} height={18} />
              <input
                id="catalog-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Tìm theo tên sản phẩm, thương hiệu hoặc gian hàng..."
                value={search}
                onChange={(event) => updateFilter('q', event.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-canvas border border-line text-sm text-ink focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                id="supplier-filter"
                aria-label="Lọc theo nhà cung cấp"
                value={supplier}
                onChange={(event) => updateFilter('supplier', event.target.value)}
                className="w-full h-11 px-3.5 border border-line rounded-xl text-xs sm:text-sm bg-canvas focus:bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                <option value="">Tất cả Nhà cung cấp</option>
                {suppliers.map(([id, name]) => (
                  <option key={id} value={id}>
                    Kho: {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom row: Sort tabs (Like Shopee / Lazada) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/70 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-subtle font-semibold mr-1">Sắp xếp theo:</span>
              {[
                { label: 'Phổ biến', val: '' },
                { label: 'Giá thấp đến cao', val: 'price-asc' },
                { label: 'Giá cao đến thấp', val: 'price-desc' },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => updateFilter('sort', s.val)}
                  className={`px-3.5 py-1.5 rounded-xl font-semibold transition ${
                    sort === s.val
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-canvas text-subtle hover:text-ink hover:bg-muted border border-line'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {(search || supplier || sort) && (
              <button
                type="button"
                className="text-rose-600 hover:underline font-semibold flex items-center gap-1"
                onClick={() => window.history.replaceState(null, '', '/catalog')}
              >
                <Icon name="close" width={14} height={14} />
                <span>Xóa toàn bộ bộ lọc</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Product count stats */}
      {!featured && !loading && !error && (
        <div className="flex justify-between items-center gap-3 mb-5 text-xs text-subtle">
          <p role="status">
            Tìm thấy <strong>{total}</strong> sản phẩm {search ? `cho "${search}"` : 'đang mở bán'}
          </p>
        </div>
      )}

      {/* Grid or States */}
      {loading ? (
        <div aria-label="Đang tải sản phẩm" aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-96 rounded-3xl border border-line bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="p-12 text-center bg-surface border border-line rounded-3xl">
          <p className="mb-4 text-subtle text-sm">{error}</p>
          <Button onClick={() => setRevision((value) => value + 1)}>Thử lại</Button>
        </div>
      ) : !shown.length ? (
        <div className="py-20 text-center border border-line rounded-3xl bg-surface">
          <div className="w-12 h-12 rounded-2xl bg-muted text-subtle mx-auto flex items-center justify-center mb-4">
            <Icon name="search" width={24} height={24} />
          </div>
          <h2 className="text-base font-bold text-ink">Chưa tìm thấy sản phẩm phù hợp</h2>
          <p className="text-subtle text-xs mt-1 max-w-sm mx-auto">
            Thử tìm kiếm với từ khóa khác hoặc xóa bớt tiêu chí lọc nhà cung cấp.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              onAddToCart={add}
              isAdding={adding === item.id}
              disabled={adding !== null}
            />
          ))}
        </div>
      )}

      {!featured && !loading && !error && totalPages > 1 && (
        <nav aria-label="Phân trang sản phẩm" className="flex items-center justify-center gap-4 mt-6">
          <Button variant="outline" disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))}>Trang trước</Button>
          <span>Trang {page} / {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => updateFilter('page', String(page + 1))}>Trang sau</Button>
        </nav>
      )}
      {/* Toast Notice */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-ink text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 text-xs"
        >
          <div className="flex-1">
            <p className="font-medium leading-relaxed">{notice.text}</p>
            {notice.success && (
              <Link
                href="/cart"
                className="inline-flex items-center gap-1 mt-2 text-emerald-400 font-bold hover:underline"
              >
                <span>Đi đến giỏ hàng</span>
                <Icon name="arrow" width={14} height={14} />
              </Link>
            )}
          </div>
          <button
            type="button"
            aria-label="Đóng thông báo"
            className="w-6 h-6 flex justify-center items-center text-slate-400 hover:text-white"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" width={14} height={14} />
          </button>
        </div>
      )}
      {/* Login Modal Popup */}
      {loginModalOpen && (
        <LoginModal
          actionMessage={
            pendingItem
              ? `Đăng nhập để thêm "${pendingItem.productName}" vào giỏ hàng`
              : 'Đăng nhập để tiếp tục mua sắm'
          }
          redirectUrl="/cart"
          onClose={() => {
            setLoginModalOpen(false);
            setPendingItem(null);
          }}
          onSuccess={() => {
            if (pendingItem) {
              const toAdd = pendingItem;
              setPendingItem(null);
              setTimeout(() => {
                add(toAdd);
              }, 300);
            }
          }}
        />
      )}
    </div>
  );
}
