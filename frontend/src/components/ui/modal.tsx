'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './icon';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const active = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; active?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[85dvh] overflow-y-auto overscroll-contain bg-surface text-ink rounded-2xl border border-line p-5 sm:p-7 shadow-xl backdrop:bg-ink/40">
    <div className="flex justify-between items-center gap-3 mb-6"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" aria-label="Đóng hộp thoại" onClick={onClose} className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center hover:bg-muted"><Icon name="close" /></button></div>
    {children}
  </dialog>;
}
