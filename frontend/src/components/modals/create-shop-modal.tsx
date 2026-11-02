'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface CreateShopModalProps {
  onConfirm: (shopName: string) => Promise<void> | void;
  onClose: () => void;
}

export function CreateShopModal({ onConfirm, onClose }: CreateShopModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên gian hàng.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Tên gian hàng phải có ít nhất 3 ký tự.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo gian hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Tạo gian hàng mới"
      subtitle="Thiết lập không gian kinh doanh riêng của bạn trên nền tảng DropConnect"
      onClose={onClose}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="shop-name-input" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-2">
            Tên gian hàng
          </label>
          <Input
            id="shop-name-input"
            type="text"
            value={name}
            placeholder="Ví dụ: Phụ Kiện GenZ, Gia Dụng Thông Minh..."
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            className="w-full text-base font-medium py-3 px-4 rounded-xl border-line bg-canvas focus:bg-surface"
          />
          <p className="text-xs text-subtle mt-2 leading-relaxed">
            Tên gian hàng sẽ hiển thị cho khách hàng trên các sản phẩm niêm yết và chi tiết đơn mua.
          </p>
          {error && (
            <p role="alert" className="text-xs text-rose-600 font-medium mt-2 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" variant="default" isLoading={submitting}>
            Tạo gian hàng
          </Button>
        </div>
      </form>
    </Modal>
  );
}
