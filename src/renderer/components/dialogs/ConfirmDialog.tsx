import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BaseDialog } from './BaseDialog';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  footerLeft?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  footerLeft,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onConfirm();
      }
    };
    // Capture phase so dnd-kit's bubble-phase KeyboardSensor never sees the event
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onConfirm]);
  const confirmStyles = {
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    default: 'bg-blue-600 hover:bg-blue-500 text-white',
  };

  const iconStyles = {
    danger: 'text-red-400',
    warning: 'text-yellow-400',
    default: 'text-blue-400',
  };

  return (
    <BaseDialog
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle size={16} className={iconStyles[variant]} />}
      zIndex="z-[60]"
      footer={
        <div className="flex items-center">
          {footerLeft && <div className="flex-1 flex items-center">{footerLeft}</div>}
          <div className="flex justify-end gap-3 ml-auto">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-xs text-fg-muted hover:text-fg-secondary border border-edge-input hover:border-fg-faint rounded transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-1.5 text-xs rounded transition-colors ${confirmStyles[variant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      }
    >
      <div className="text-sm text-fg-muted space-y-2">
        {typeof message === 'string'
          ? <p>{message}</p>
          : message
        }
      </div>
    </BaseDialog>
  );
}
