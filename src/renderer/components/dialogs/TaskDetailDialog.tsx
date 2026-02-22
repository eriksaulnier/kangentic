import React, { useState } from 'react';
import { useBoardStore } from '../../stores/board-store';
import { useSessionStore } from '../../stores/session-store';
import type { Task } from '../../../shared/types';

interface TaskDetailDialogProps {
  task: Task;
  onClose: () => void;
}

export function TaskDetailDialog({ task, onClose }: TaskDetailDialogProps) {
  const updateTask = useBoardStore((s) => s.updateTask);
  const deleteTask = useBoardStore((s) => s.deleteTask);
  const killSession = useSessionStore((s) => s.killSession);
  const sessions = useSessionStore((s) => s.sessions);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [isEditing, setIsEditing] = useState(false);

  const session = task.session_id ? sessions.find((s) => s.id === task.session_id) : null;

  const handleSave = async () => {
    await updateTask({ id: task.id, title, description });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (task.session_id) {
      await killSession(task.session_id);
    }
    await deleteTask(task.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-800 border border-zinc-700 rounded-lg p-5 w-[480px] shadow-xl max-h-[80vh] overflow-y-auto"
      >
        {isEditing ? (
          <>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 mb-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 mb-3 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                Cancel
              </button>
              <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded">
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-zinc-100">{task.title}</h2>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
            </div>

            {task.description && (
              <p className="text-sm text-zinc-400 mb-4 whitespace-pre-wrap">{task.description}</p>
            )}

            {/* Session info */}
            {session && (
              <div className="bg-zinc-900 rounded p-3 mb-4 text-sm">
                <div className="flex items-center gap-2 text-zinc-300">
                  <div className={`w-2 h-2 rounded-full ${
                    session.status === 'running' ? 'bg-green-400' :
                    session.status === 'queued' ? 'bg-yellow-400' :
                    'bg-zinc-400'
                  }`} />
                  <span>Agent: {task.agent}</span>
                  <span className="text-zinc-500">({session.status})</span>
                </div>
                {session.pid && (
                  <div className="text-zinc-500 mt-1">PID: {session.pid}</div>
                )}
              </div>
            )}

            {/* Worktree / PR info */}
            {(task.worktree_path || task.pr_url) && (
              <div className="bg-zinc-900 rounded p-3 mb-4 text-sm space-y-1">
                {task.branch_name && (
                  <div className="text-zinc-400">Branch: <span className="text-zinc-200">{task.branch_name}</span></div>
                )}
                {task.pr_url && (
                  <div className="text-zinc-400">PR: <span className="text-blue-400">#{task.pr_number}</span></div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-4 pt-3 border-t border-zinc-700">
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
