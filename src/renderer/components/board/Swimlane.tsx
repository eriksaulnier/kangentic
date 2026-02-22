import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { NewTaskDialog } from '../dialogs/NewTaskDialog';
import type { Swimlane as SwimlaneType, Task } from '../../../shared/types';

interface SwimlaneProps {
  swimlane: SwimlaneType;
  tasks: Task[];
}

export function Swimlane({ swimlane, tasks }: SwimlaneProps) {
  const [showNewTask, setShowNewTask] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: swimlane.id,
    data: { type: 'swimlane' },
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-zinc-800/50 rounded-lg">
      {/* Column header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-zinc-700/50">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: swimlane.color }}
        />
        <span className="text-sm font-medium text-zinc-200 truncate">{swimlane.name}</span>
        <span className="text-xs text-zinc-500 ml-auto">{tasks.length}</span>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px] transition-colors ${
          isOver ? 'bg-zinc-700/30' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>

      {/* Add task button */}
      <div className="p-2 border-t border-zinc-700/50">
        <button
          onClick={() => setShowNewTask(true)}
          className="w-full text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded px-2 py-1 transition-colors text-left"
        >
          + Add task
        </button>
      </div>

      {showNewTask && (
        <NewTaskDialog
          swimlaneId={swimlane.id}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </div>
  );
}
