'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';

interface CostPriceModalProps {
  productName: string;
  sku: string;
  currentCost: number;
  onConfirm: (newCost: number) => Promise<void> | void;
  onClose: () => void;
}

export function CostPriceModal({
  productName,
  sku,
  currentCost,
  onConfirm,
  onClose,
}: CostPriceModalProps) {
  const [cost, setCost] = useState<number>(currentCost);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(cost) || cost <= 0) {
      setError('Giá vốn cung cấp phải lớn hơn 0 VND.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(cost);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể cập nhật giá vốn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Cập nhật giá vốn giao buôn"
      subtitle="Thiết lập đơn giá cung cấp cho các Seller bán dropship"
      onClose={onClose}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product card */}
        <div className="p-4 rounded-2xl bg-canvas border border-line flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-bold text-primary uppercase bg-primary-soft px-2 py-0.5 rounded">
              {sku}
            </span>
            <h4 className="text-sm font-bold text-ink mt-1 truncate">{productName}</h4>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-subtle block">Giá vốn hiện tại</span>
            <span className="text-sm font-bold text-ink">{currentCost.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>

        {/* Input */}
        <div>
          <label htmlFor="cost-price-input" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-2">
            Giá vốn mới (VND)
          </label>
          <div className="relative">
            <input
              id="cost-price-input"
              type="number"
              min={1000}
              step="any"
              value={cost}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCost(isNaN(val) ? 0 : val);
                if (error) setError(null);
              }}
              className="w-full text-lg font-bold py-3 pl-4 pr-12 rounded-xl border border-line bg-canvas focus:bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-subtle">
              VND
            </span>
          </div>
          <div className="text-xs text-subtle mt-1.5 flex justify-between">
            <span>Tương đương: <strong>{cost.toLocaleString('vi-VN')} đ</strong></span>
            {cost !== currentCost && (
              <span className={cost > currentCost ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                {cost > currentCost ? `Tăng ${(cost - currentCost).toLocaleString('vi-VN')} đ` : `Giảm ${(currentCost - cost).toLocaleString('vi-VN')} đ`}
              </span>
            )}
          </div>
        </div>

        {/* Policy notice */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs leading-relaxed flex items-start gap-2.5">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <strong>Lưu ý chính sách Margin:</strong> Nếu giá vốn tăng khiến niêm yết của Seller không đạt biên lợi nhuận tối thiểu 10%, listing đó sẽ tự động chuyển sang trạng thái <em>PAUSED_PRICE_MISMATCH</em> và tạm ẩn cho đến khi Seller cập nhật lại giá bán lẻ.
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" variant="default" isLoading={submitting}>
            Cập nhật giá vốn
          </Button>
        </div>
      </form>
    </Modal>
  );
}
