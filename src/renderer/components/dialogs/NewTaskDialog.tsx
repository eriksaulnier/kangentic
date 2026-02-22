import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../../stores/board-store';

interface NewTaskDialogProps {
  swimlaneId: string;
  onClose: () => void;
}

export function NewTaskDialog({ swimlaneId, onClose }: NewTaskDialogProps) {
  const createTask = useBoardStore((s) => s.createTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ title: title.trim(), description: description.trim(), swimlane_id: swimlaneId });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 w-96 shadow-xl"
      >
        <h3 className="text-sm font-medium text-zinc-200 mb-3">New Task</h3>
        <input
          ref={inputRef}
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 mb-2"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 mb-3 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
