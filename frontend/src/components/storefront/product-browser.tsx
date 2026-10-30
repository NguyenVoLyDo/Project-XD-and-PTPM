'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiClient } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { ListingCard, type ListingCardItem } from '../organisms/catalog/listing-card';
import { Icon } from '../ui/icon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
export function ProductBrowser({ featured = false }: { featured?: boolean }) {
  const params = useSearchParams();
  const search = featured ? '' : params.get('q') || '';
  const supplier = featured ? '' : params.get('supplier') || '';
  const sort = featured ? '' : params.get('sort') || '';
  const [items, setItems] = useState<ListingCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; success: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const { currentUser, refreshCartCount } = useAuth();

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    ApiClient.get<ListingCardItem[]>('/listings')
      .then(data => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError('Chưa tải được sản phẩm. Kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    window.history.replaceState(null, '', '/catalog' + (next.size ? '?' + next.toString() : ''));
  };
  const suppliers = Array.from(new Map(items.filter(item => item.supplierId).map(item => [item.supplierId!, item.supplierName || item.supplierId!])).entries());
  const visible = items.filter(item => (!supplier || item.supplierId === supplier) &&
    normalize(item.productName + ' ' + (item.shopName || '')).includes(normalize(search)));
  if (sort === 'price-asc') visible.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
  if (sort === 'price-desc') visible.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
  const shown = featured ? visible.slice(0, 3) : visible;

  const add = async (item: ListingCardItem) => {
    if (busy.current) return;
    if (timer.current) clearTimeout(timer.current);
    if (currentUser.role !== 'CUSTOMER') {
      setNotice({ text: 'Chọn tài khoản Khách hàng C ở đầu trang để mua sản phẩm.', success: false });
      return;
    }
    busy.current = true; setAdding(item.id);
    try {
      const cart = await ApiClient.get<{ items: Array<{ listingId: string; quantity: number }> }>('/cart');
      const quantity = (cart.items.find(line => line.listingId === item.id)?.quantity || 0) + 1;
      await ApiClient.put('/cart/items/' + encodeURIComponent(item.id), { quantity });
      await refreshCartCount();
      setNotice({ text: 'Đã thêm ' + item.productName + ' vào giỏ hàng.', success: true });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Chưa thêm được sản phẩm. Vui lòng thử lại.', success: false });
    } finally {
      setAdding(null); busy.current = false;
      timer.current = setTimeout(() => setNotice(null), 7000);
    }
  };

  return <div>
    {!featured && <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 mb-7 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
      <div><label htmlFor="catalog-search" className="block text-sm font-semibold mb-2">Tìm sản phẩm</label>
        <div className="relative"><Icon name="search" className="absolute top-3 left-3 text-subtle" /><Input id="catalog-search" name="q" type="search" autoComplete="off" placeholder="Tên sản phẩm hoặc gian hàng…" value={search} onChange={event => updateFilter('q', event.target.value)} className="pl-10" /></div>
      </div>
      <div><label htmlFor="supplier-filter" className="block text-sm font-semibold mb-2">Nhà cung cấp</label>
        <select id="supplier-filter" value={supplier} onChange={event => updateFilter('supplier', event.target.value)} className="w-full min-h-11 p-2.5 border border-line rounded-xl text-sm">
          <option value="">Tất cả nhà cung cấp</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      <div><label htmlFor="product-sort" className="block text-sm font-semibold mb-2">Sắp xếp</label>
        <select id="product-sort" value={sort} onChange={event => updateFilter('sort', event.target.value)} className="w-full min-h-11 p-2.5 border border-line rounded-xl text-sm">
          <option value="">Mặc định</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option>
        </select>
      </div>
    </div>}
    {!featured && !loading && !error && <div className="flex justify-between items-center gap-3 mb-5 text-sm"><p role="status" className="text-subtle">{shown.length} sản phẩm{search ? ' phù hợp' : ' đang được niêm yết'}</p>
      {(search || supplier || sort) && <button type="button" className="text-primary underline underline-offset-4 min-h-10" onClick={() => window.history.replaceState(null, '', '/catalog')}>Xóa bộ lọc</button>}
    </div>}
    {loading ? <div aria-label="Đang tải sản phẩm" aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="h-96 rounded-2xl border border-line bg-muted animate-pulse" />)}</div>
      : error ? <div role="alert" className="p-10 text-center bg-surface border border-line rounded-2xl"><p className="mb-4 text-subtle">{error}</p><Button onClick={() => setRevision(value => value + 1)}>Thử lại</Button></div>
      : !shown.length ? <div className="py-16 text-center border border-line rounded-2xl bg-surface"><Icon name="search" className="mx-auto text-subtle mb-4" width={32} height={32} /><h2 className="text-lg font-semibold">Chưa tìm thấy sản phẩm phù hợp</h2><p className="text-subtle text-sm mt-2">Thử một tên khác hoặc bỏ bộ lọc nhà cung cấp.</p></div>
      : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.map(item => <ListingCard key={item.id} item={item} onAddToCart={add} isAdding={adding === item.id} disabled={adding !== null} />)}</div>}
    {notice && <div role="status" className="toast flex items-start gap-3"><div className="flex-1"><p>{notice.text}</p>{notice.success && <Link href="/cart" className="inline-block mt-2 text-white underline underline-offset-4">Xem giỏ hàng</Link>}</div><button type="button" aria-label="Đóng thông báo" className="min-w-8 min-h-8 flex justify-center items-center" onClick={() => setNotice(null)}><Icon name="close" width={16} height={16} /></button></div>}
  </div>;
}
