'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './icon';
interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const widthClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
};

export function Modal({ title, subtitle, onClose, children, maxWidth = 'lg' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const subId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const active = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      active?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subId : undefined}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={e => {
        if (e.target === ref.current) {
          onClose();
        }
      }}
      className={`m-auto w-[calc(100%-2rem)] ${widthClasses[maxWidth]} max-h-[88dvh] overflow-y-auto overscroll-contain bg-surface text-ink rounded-3xl border border-line p-6 sm:p-8 shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm transition-all animate-in fade-in zoom-in-95`}
    >
      <div className="flex justify-between items-start gap-4 mb-6 pb-4 border-b border-line">
        <div>
          <h2 id={titleId} className="text-xl font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p id={subId} className="text-xs text-subtle mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-label="Đóng hộp thoại"
          onClick={onClose}
          className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-subtle hover:text-ink hover:bg-muted border border-transparent hover:border-line transition"
        >
          <Icon name="close" width={18} height={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
