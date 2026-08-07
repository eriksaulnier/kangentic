import { FolderGit2 } from 'lucide-react';
import { Pill } from '../Pill';

interface WorktreeChipProps {
  enabled: boolean;
  onToggle: () => void;
  /** Reason the toggle is locked. Renders as the tooltip and blocks clicks. */
  lockedReason?: string;
}

export function WorktreeChip({ enabled, onToggle, lockedReason }: WorktreeChipProps) {
  return (
    <Pill
      onClick={lockedReason ? undefined : onToggle}
      className={`border transition-colors ${
        lockedReason
          ? 'border-edge-input text-fg-disabled cursor-not-allowed opacity-60'
          : enabled
            ? 'border-edge-input text-fg-muted hover:text-fg-secondary hover:border-fg-faint'
            : 'border-edge-input text-fg-disabled hover:border-fg-faint'
      }`}
      title={lockedReason ?? (enabled ? 'Worktree enabled (click to toggle)' : 'Worktree disabled (click to toggle)')}
      data-testid="worktree-toggle"
    >
      <FolderGit2 size={16} className={enabled ? '' : 'opacity-40'} />
      <span className={enabled ? '' : 'line-through opacity-60'}>Worktree</span>
    </Pill>
  );
}
