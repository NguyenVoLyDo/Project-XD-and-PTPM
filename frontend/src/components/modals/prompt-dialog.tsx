'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface PromptDialogProps {
  title: string;
  subtitle?: string;
  label?: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: 'text' | 'number';
  helperText?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => Promise<void> | void;
  onClose: () => void;
  validate?: (value: string) => string | null;
}

export function PromptDialog({
  title,
  subtitle,
  label,
  defaultValue = '',
  placeholder,
  type = 'text',
  helperText,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  onConfirm,
  onClose,
  validate,
}: PromptDialogProps) {
  const [value, setValue] = useState(String(defaultValue));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate) {
      const err = validate(value);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(value);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi thực hiện thao tác.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          {label && (
            <label className="block text-xs font-semibold text-subtle uppercase tracking-wider mb-2">
              {label}
            </label>
          )}
          <Input
            type={type}
            value={value}
            placeholder={placeholder}
            autoFocus
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            className="w-full text-base font-medium py-3 px-4 rounded-xl border-line bg-canvas focus:bg-surface"
          />
          {helperText && !error && (
            <p className="text-xs text-subtle mt-2 leading-relaxed">{helperText}</p>
          )}
          {error && (
            <p role="alert" className="text-xs text-rose-600 font-medium mt-2 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {cancelText}
          </Button>
          <Button type="submit" variant="default" isLoading={submitting}>
            {confirmText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
