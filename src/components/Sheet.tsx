import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Panel som glider upp från nederkanten. Stängs med Escape eller tryck utanför. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="h3">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Stäng">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({ title, body, confirmLabel, danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <p className="muted">{body}</p>
      <div className="stack-sm" style={{ marginTop: 20 }}>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Avbryt
        </button>
      </div>
    </Sheet>
  );
}
