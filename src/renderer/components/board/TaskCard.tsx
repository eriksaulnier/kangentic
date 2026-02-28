import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, Trash2, CirclePause, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { TaskDetailDialog } from '../dialogs/TaskDetailDialog';
import { useSessionStore } from '../../stores/session-store';
import { useBoardStore } from '../../stores/board-store';
import { getProgressColor } from '../../utils/color-lerp';
import type { Task } from '../../../shared/types';

interface TaskCardProps {
  task: Task;
  isDragOverlay?: boolean;
  compact?: boolean;
  onDelete?: (taskId: string) => void;
}

const TaskCardInner = function TaskCard({ task, isDragOverlay, compact, onDelete }: TaskCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const openTaskId = useSessionStore((s) => s.openTaskId);
  const setOpenTaskId = useSessionStore((s) => s.setOpenTaskId);
  const usage = useSessionStore((s) => task.session_id ? s.sessionUsage[task.session_id] : undefined);
  const activity = useSessionStore((s) => task.session_id ? s.sessionActivity[task.session_id] : undefined);
  const events = useSessionStore((s) => task.session_id ? s.sessionEvents[task.session_id] : undefined);

  const suspendSession = useSessionStore((s) => s.suspendSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const loadBoard = useBoardStore((s) => s.loadBoard);

  const session = task.session_id ? sessions.find((s) => s.id === task.session_id) : null;
  const isHighlighted = !!task.session_id && task.session_id === activeSessionId;
  // For toggle: find session by taskId (includes suspended sessions)
  const taskSession = sessions.find((s) => s.taskId === task.id);
  // Only "initializing" while waiting for BOTH usage data AND the first hook event.
  // Once any event arrives (tool_start, prompt, idle, permission_request) Claude Code
  // is running — the card should reflect the real activity state, not "Initializing...".
  const hasReceivedEvents = !!events && events.length > 0;
  const isInitializing = !!taskSession && !usage && !hasReceivedEvents && taskSession.status !== 'suspended' && taskSession.status !== 'exited';
  const isThinking = session?.status === 'running' && activity !== 'idle' && !isInitializing;
  const isIdle = session?.status === 'running' && activity === 'idle' && !isInitializing;
  const canToggle = taskSession && (taskSession.status === 'running' || taskSession.status === 'queued' || taskSession.status === 'suspended');
  const isSessionActive = taskSession?.status === 'running' || taskSession?.status === 'queued';
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canToggle || toggling) return;
    setToggling(true);
    try {
      if (isSessionActive) {
        await suspendSession(task.id);
      } else {
        await resumeSession(task.id);
      }
      await loadBoard();
    } catch (err) {
      console.error('Toggle session failed:', err);
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    if (openTaskId === task.id) {
      setShowDetail(true);
      setOpenTaskId(null);
    }
  }, [openTaskId, task.id, setOpenTaskId]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? 'translate3d(0, 0, 0)',
    transition: transition ?? 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragOverlay) return;
    e.stopPropagation();
    setShowDetail(true);
  };

  if (compact) {
    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={handleClick}
          data-task-id={task.id}
          className={`bg-surface-raised/60 border border-edge/50 rounded-md px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:border-edge-input transition-colors group/card ${
            isDragOverlay ? 'shadow-xl' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-fg-tertiary truncate flex-1">{task.title}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-fg-disabled">
                {task.archived_at ? formatDistanceToNow(new Date(task.archived_at), { addSuffix: true }) : ''}
              </span>
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  className="ml-1.5 p-2 rounded-full text-fg-disabled hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/card:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {showDetail && (
          <TaskDetailDialog task={task} onClose={() => setShowDetail(false)} initialEdit={!taskSession && !task.archived_at} />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        data-task-id={task.id}
        className={`border rounded-md p-2.5 cursor-grab active:cursor-grabbing transition-colors bg-surface-raised ${
          isHighlighted ? 'border-[2px] border-fg-faint/60' : isIdle ? 'border-edge/40' : 'border-edge hover:border-edge-input'
        } ${isIdle ? 'animate-pulse-subtle' : ''
        } ${isDragOverlay ? 'shadow-xl' : ''}`}
      >
        <div className="flex items-center gap-1.5">
          {isIdle && (
            <Mail size={14} className="text-fg-muted shrink-0" />
          )}
          {isThinking && (
            <Loader2 size={14} className="text-emerald-400 animate-spin shrink-0" />
          )}
          <div className="text-sm text-fg font-medium truncate">{task.title}</div>
        </div>

        {task.pr_url && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-accent-fg">
              PR #{task.pr_number}
            </span>
          </div>
        )}

        {task.description && (
          <div className="text-xs text-fg-faint mt-1 line-clamp-3">{task.description}</div>
        )}

        {usage ? (() => {
          const pct = Math.round(usage.contextWindow.usedPercentage);
          const progressColor = getProgressColor(pct);
          return (
            <div className="mt-2 pt-2 border-t border-edge" data-testid="usage-bar">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-fg-faint">
                  {usage.model.displayName || 'Claude'}
                </span>
                <span className="text-xs text-fg-faint">{pct}%</span>
              </div>
              <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: progressColor }}
                />
              </div>
            </div>
          );
        })() : taskSession && taskSession.status !== 'exited' && (taskSession.status === 'suspended' || taskSession.status === 'queued' || isInitializing) && (
          <div className="mt-2 pt-2 border-t border-edge" data-testid="initializing-bar">
            <span className="text-xs text-fg-faint flex items-center gap-1">
              {taskSession?.status === 'suspended' ? (
                <>
                  <CirclePause size={12} />
                  Paused
                </>
              ) : (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {session?.status === 'queued' ? 'Queued...' : 'Initializing...'}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {showDetail && (
        <TaskDetailDialog task={task} onClose={() => setShowDetail(false)} initialEdit={!taskSession && !task.archived_at} />
      )}
    </>
  );
};

export const TaskCard = React.memo(TaskCardInner);
