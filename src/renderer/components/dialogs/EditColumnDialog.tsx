import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Lock, Trash2, Palette, ChevronRight } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { useBoardStore } from '../../stores/board-store';
import { useToastStore } from '../../stores/toast-store';
import { BaseDialog } from './BaseDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { IconPickerDialog } from './IconPickerDialog';
import { ICON_REGISTRY, ROLE_DEFAULTS, getUsedIcons } from '../../utils/swimlane-icons';
import type { Swimlane } from '../../../shared/types';

const PRESET_COLORS = [
  '#6b7280', '#ef4444', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

interface EditColumnDialogProps {
  swimlane: Swimlane;
  onClose: () => void;
}

export function EditColumnDialog({ swimlane, onClose }: EditColumnDialogProps) {
  const updateSwimlane = useBoardStore((s) => s.updateSwimlane);
  const deleteSwimlane = useBoardStore((s) => s.deleteSwimlane);
  const tasks = useBoardStore((s) => s.tasks);

  const swimlanes = useBoardStore((s) => s.swimlanes);

  const [name, setName] = useState(swimlane.name);
  const [color, setColor] = useState(swimlane.color);
  const [icon, setIcon] = useState<string | null>(swimlane.icon);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [hexInput, setHexInput] = useState(swimlane.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const taskCount = tasks.filter((t) => t.swimlane_id === swimlane.id).length;
  const isLocked = swimlane.role !== null;

  const usedIcons = getUsedIcons(swimlanes, swimlane.id);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    await updateSwimlane({ id: swimlane.id, name: name.trim(), color, icon });
    onClose();
  };

  const handleDelete = async () => {
    if (taskCount > 0) {
      setError(`Move or delete all ${taskCount} task${taskCount > 1 ? 's' : ''} first.`);
      setConfirmDelete(false);
      return;
    }
    try {
      const colName = swimlane.name;
      await deleteSwimlane(swimlane.id);
      useToastStore.getState().addToast({
        message: `Deleted column "${colName}"`,
        variant: 'info',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete column.');
      setConfirmDelete(false);
    }
  };

  if (confirmDelete) {
    return (
      <ConfirmDialog
        title="Delete column"
        message={<>
          <p>Are you sure you want to delete this column?</p>
          <p className="text-fg-secondary bg-surface rounded px-3 py-2 truncate" title={swimlane.name}>{swimlane.name}</p>
        </>}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    );
  }

  return (
    <BaseDialog
      onClose={onClose}
      title="Edit Column"
        icon={<Pencil size={14} className="text-fg-muted" />}
        headerRight={isLocked ? (
          <span className="text-xs text-fg-faint flex items-center gap-1 flex-shrink-0">
            <Lock size={12} />
            System
          </span>
        ) : undefined}
        footer={
          <div className="flex items-center">
            <div className="flex-1">
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 border border-red-400/40 hover:text-red-300 hover:border-red-300/50 hover:bg-red-400/10 rounded transition-colors"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs text-fg-muted hover:text-fg-secondary border border-edge-input hover:border-fg-faint rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-1.5 text-xs bg-accent-emphasis hover:bg-accent text-accent-on rounded transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Name input */}
          <div>
            <label className="text-xs text-fg-muted mb-1.5 block">Name</label>
            <input
              ref={inputRef}
              type="text"
              placeholder="Column name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              className="w-full bg-surface border border-edge-input rounded px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-accent"
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-xs text-fg-muted mb-1.5 block">Icon</label>
            <button
              type="button"
              onClick={() => setShowIconPicker(true)}
              className="w-full flex items-center gap-2.5 bg-surface border border-edge-input hover:border-fg-faint rounded px-3 py-2 transition-colors group"
            >
              <div className="flex-shrink-0">
                {(() => {
                  if (icon) {
                    const IconComp = ICON_REGISTRY.get(icon);
                    if (IconComp) return <IconComp size={14} strokeWidth={1.75} style={{ color }} />;
                  }
                  if (swimlane.role) {
                    const RoleIcon = ROLE_DEFAULTS[swimlane.role];
                    return <RoleIcon size={14} strokeWidth={1.75} style={{ color }} />;
                  }
                  return (
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  );
                })()}
              </div>
              <span className="text-xs text-fg-tertiary flex-1 text-left truncate">
                {icon ?? (swimlane.role ? `Default (${swimlane.role})` : 'None')}
              </span>
              <ChevronRight size={14} className="text-fg-faint group-hover:text-fg-muted flex-shrink-0" />
            </button>
          </div>

          {showIconPicker && (
            <IconPickerDialog
              selectedIcon={icon}
              accentColor={color}
              usedIcons={usedIcons}
              onSelect={(name) => { setIcon(name); setShowIconPicker(false); }}
              onClose={() => setShowIconPicker(false)}
            />
          )}

          {/* Color picker */}
          <div>
            <label className="text-xs text-fg-muted mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setHexInput(c);
                    setShowCustomPicker(false);
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:border-fg-faint'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                type="button"
                onClick={() => setShowCustomPicker(!showCustomPicker)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  showCustomPicker ? 'border-white bg-surface-hover' : 'border-edge-input hover:border-fg-muted bg-surface-raised'
                }`}
                title="Custom color"
              >
                <Palette size={12} className="text-fg-muted" />
              </button>
            </div>

            {showCustomPicker && (
              <div className="mt-3 space-y-2">
                <HexColorPicker
                  color={color}
                  onChange={(c) => { setColor(c); setHexInput(c); }}
                  className="!w-full"
                />
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHexInput(v);
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(v);
                  }}
                  onBlur={() => {
                    if (!/^#[0-9a-fA-F]{6}$/.test(hexInput)) setHexInput(color);
                  }}
                  className="w-full bg-surface border border-edge-input rounded px-3 py-1.5 text-sm text-fg font-mono focus:outline-none focus:border-accent"
                  placeholder="#000000"
                  maxLength={7}
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      </BaseDialog>
  );
}
