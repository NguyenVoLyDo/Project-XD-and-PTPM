'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';

interface RetailPriceModalProps {
  productName: string;
  sellerSku?: string;
  currentPrice: number;
  costPrice: number;
  minimumPrice?: number;
  onConfirm: (newPrice: number) => Promise<void> | void;
  onClose: () => void;
}

export function RetailPriceModal({
  productName,
  sellerSku,
  currentPrice,
  costPrice,
  minimumPrice,
  onConfirm,
  onClose,
}: RetailPriceModalProps) {
  const minRequired = minimumPrice ?? Math.ceil(costPrice * 1.1);
  const [salePrice, setSalePrice] = useState<number>(currentPrice);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const profit = salePrice - costPrice;
  const marginPercent = costPrice > 0 ? Math.round((profit / costPrice) * 100) : 0;
  const isMarginValid = salePrice >= minRequired;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(salePrice) || salePrice <= 0) {
      setError('Giá bán lẻ phải là số dương hợp lệ.');
      return;
    }
    if (!isMarginValid) {
      setError(`Giá bán lẻ phải tối thiểu là ${minRequired.toLocaleString('vi-VN')} đ theo chính sách sàn.`);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(salePrice);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể cập nhật giá bán lẻ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Điều chỉnh giá bán lẻ"
      subtitle="Thiết lập giá niêm yết cho khách hàng trên gian hàng của bạn"
      onClose={onClose}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product summary card */}
        <div className="p-4 rounded-2xl bg-canvas border border-line space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-ink truncate">{productName}</h4>
            {sellerSku && (
              <span className="font-mono text-[11px] font-bold text-primary uppercase bg-primary-soft px-2 py-0.5 rounded shrink-0">
                {sellerSku}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between text-xs text-subtle pt-2 border-t border-line">
            <span>Giá vốn từ NCC: <strong className="text-ink">{costPrice.toLocaleString('vi-VN')} đ</strong></span>
            <span>
              Giá tối thiểu (Margin 10%):&nbsp;
              <strong className="text-success">{minRequired.toLocaleString('vi-VN')} đ</strong>
            </span>
          </div>
        </div>

        {/* Input */}
        <div>
          <label htmlFor="retail-price-input" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-2">
            Giá bán lẻ mới (VND)
          </label>
          <div className="relative">
            <input
              id="retail-price-input"
              type="number"
              min={minRequired}
              step="any"
              value={salePrice}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSalePrice(isNaN(val) ? 0 : val);
                if (error) setError(null);
              }}
              className={`w-full text-lg font-bold py-3 pl-4 pr-12 rounded-xl border text-ink bg-canvas focus:bg-surface focus:outline-none focus:ring-2 transition-[border-color,box-shadow] ${
                isMarginValid
                  ? 'border-line focus:ring-primary/20 focus:border-primary'
                  : 'border-danger focus:ring-danger/20'
              }`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-subtle">
              VND
            </span>
          </div>
        </div>

        {/* Live Profit Preview Box */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isMarginValid
              ? 'bg-success-soft border-success/20'
              : 'bg-danger-soft border-danger/30'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-subtle">
              Dự tính lợi nhuận mỗi đơn
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isMarginValid
                  ? 'bg-success/15 text-success'
                  : 'bg-danger/15 text-danger'
              }`}
            >
              {isMarginValid ? '✓ Đạt chuẩn sàn' : '✗ Không đạt Margin'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink">Lợi nhuận gộp:</span>
            <span className={`text-xl font-black tabular-nums ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
              +{profit.toLocaleString('vi-VN')} đ&nbsp;
              <span className="text-xs font-normal text-subtle">({marginPercent}%)</span>
            </span>
          </div>
          {!isMarginValid && (
            <p className="text-xs text-danger mt-2">
              Giá bán phải đạt tối thiểu {minRequired.toLocaleString('vi-VN')} đ để niêm yết được phép hiển thị trên sàn.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger font-medium flex items-center gap-1.5">
            <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" variant="default" isLoading={submitting} disabled={!isMarginValid}>
            Lưu giá bán
          </Button>
        </div>
      </form>
    </Modal>
  );
}
