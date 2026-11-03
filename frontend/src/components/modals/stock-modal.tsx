'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

interface StockModalProps {
  productName: string;
  sku: string;
  currentStock: number;
  reserved?: number;
  onConfirm: (newStock: number) => Promise<void> | void;
  onClose: () => void;
}

export function StockModal({
  productName,
  sku,
  currentStock,
  reserved = 0,
  onConfirm,
  onClose,
}: StockModalProps) {
  const [stock, setStock] = useState<number>(currentStock);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdjust = (delta: number) => {
    setStock((prev) => Math.max(0, prev + delta));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isSafeInteger(stock) || stock < reserved || stock > 2147483647) {
      setError(`Tổng tồn phải là số nguyên từ ${reserved} đến 2147483647, không thấp hơn lượng đang giữ.`);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(stock);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể cập nhật số lượng tồn kho.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Cập nhật tổng tồn kho"
      subtitle={`Đang giữ: ${reserved} chiếc. Khả dụng sau cập nhật: ${Math.max(0, stock - reserved)} chiếc.`}
      onClose={onClose}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product summary card */}
        <div className="p-4 rounded-2xl bg-canvas border border-line flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-bold text-primary uppercase bg-primary-soft px-2 py-0.5 rounded">
              {sku}
            </span>
            <h4 className="text-sm font-bold text-ink mt-1 truncate">{productName}</h4>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-subtle block">Hiện tại</span>
            <span className="text-sm font-bold text-ink">{currentStock} chiếc</span>
          </div>
        </div>

        {/* Stepper control */}
        <div>
          <label htmlFor="stock-stepper-input" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-3">
            Số lượng tồn kho mới
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAdjust(-10)}
              className="h-12 px-3 rounded-xl border border-line bg-surface hover:bg-muted font-bold text-xs text-ink transition"
              title="Giảm 10"
            >
              -10
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(-1)}
              className="h-12 w-12 rounded-xl border border-line bg-surface hover:bg-muted flex items-center justify-center font-bold text-ink transition"
              title="Giảm 1"
            >
              <Icon name="minus" width={18} height={18} />
            </button>
            <input
              id="stock-stepper-input"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => {
                const val = Number(e.target.value);
                setStock(isNaN(val) ? 0 : Math.max(0, val));
                if (error) setError(null);
              }}
              className="flex-1 min-w-0 h-12 text-center text-xl font-bold rounded-xl border border-line bg-canvas focus:bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => handleAdjust(1)}
              className="h-12 w-12 rounded-xl border border-line bg-surface hover:bg-muted flex items-center justify-center font-bold text-ink transition"
              title="Tăng 1"
            >
              <Icon name="plus" width={18} height={18} />
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(10)}
              className="h-12 px-3 rounded-xl border border-line bg-surface hover:bg-muted font-bold text-xs text-ink transition"
              title="Tăng 10"
            >
              +10
            </button>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-2 mt-3 text-xs text-subtle">
            <span>Nạp nhanh:</span>
            {[20, 50, 100, 200].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setStock(preset)}
                className="px-2.5 py-1 rounded-lg border border-line bg-canvas hover:bg-muted font-medium text-ink transition"
              >
                {preset}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger font-medium mt-3 flex items-center gap-1.5">
              <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" variant="default" isLoading={submitting}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
