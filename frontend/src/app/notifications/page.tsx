'use client';
import { useEffect, useState } from 'react';
import { ApiClient } from '../../lib/api';
import { useAuth } from '../../features/auth/hooks/use-auth';
import Link from 'next/link';
type Notice={id:string;title:string;content:string;isRead:boolean;createdAt:string};
export default function NotificationsPage(){
  const {user,isLoading}=useAuth();const [items,setItems]=useState<Notice[]>([]),[error,setError]=useState('');
  const load=async()=>{try{const result=await ApiClient.get<{items:Notice[]}>('/notifications');setItems(result.items);setError('');}catch(e){setError(e instanceof Error?e.message:'Không tải được thông báo');}};
  useEffect(()=>{if(user)void load();},[user?.userId]);
  if(isLoading)return <p role="status">Đang tải...</p>;
  if(!user)return <Link href="/login">Đăng nhập để xem thông báo</Link>;
  return <section className="space-y-4"><h1 className="text-2xl font-bold">Thông báo</h1>
    {error&&<p role="alert">{error}<button onClick={load}>Thử lại</button></p>}
    {!error&&!items.length&&<p>Chưa có thông báo.</p>}
    {items.map(item=><article className="rounded-xl border p-4 space-y-2" key={item.id}>
      <h2 className="font-semibold">{item.title}</h2><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time>
      {!item.isRead&&<button className="block text-primary" onClick={async()=>{try{await ApiClient.post(`/notifications/${item.id}/read`);await load();}catch(e){setError(e instanceof Error?e.message:'Không cập nhật được');}}}>Đánh dấu đã đọc</button>}
    </article>)}
  </section>;
}
