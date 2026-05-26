import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmColor?: string;
}

export default function ConfirmModal({
  isOpen, title, description, onConfirm, onCancel,
  confirmText = 'Confirm', confirmColor = 'var(--danger)'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            style={{
              background: confirmColor, color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem',
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
