import React, { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Swimlane } from './Swimlane';
import { TaskCard } from './TaskCard';
import { useBoardStore } from '../../stores/board-store';
import type { Task } from '../../../shared/types';

export function KanbanBoard() {
  const swimlanes = useBoardStore((s) => s.swimlanes);
  const tasks = useBoardStore((s) => s.tasks);
  const moveTask = useBoardStore((s) => s.moveTask);
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target swimlane and position
    let targetSwimlaneId: string;
    let targetPosition: number;

    const overData = over.data.current;
    if (overData?.type === 'swimlane') {
      // Dropped on empty area of swimlane
      targetSwimlaneId = over.id as string;
      const laneTasks = tasks.filter((t) => t.swimlane_id === targetSwimlaneId && t.id !== taskId);
      targetPosition = laneTasks.length;
    } else if (overData?.type === 'task') {
      // Dropped on another task
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetSwimlaneId = overTask.swimlane_id;
      targetPosition = overTask.position;
    } else {
      // Fallback: treat over.id as swimlane
      targetSwimlaneId = over.id as string;
      const laneTasks = tasks.filter((t) => t.swimlane_id === targetSwimlaneId && t.id !== taskId);
      targetPosition = laneTasks.length;
    }

    if (task.swimlane_id === targetSwimlaneId && task.position === targetPosition) return;

    await moveTask({ taskId, targetSwimlaneId, targetPosition });
  }, [tasks, moveTask]);

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full">
          {swimlanes.map((swimlane) => (
            <Swimlane
              key={swimlane.id}
              swimlane={swimlane}
              tasks={tasks.filter((t) => t.swimlane_id === swimlane.id).sort((a, b) => a.position - b.position)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="drag-overlay">
              <TaskCard task={activeTask} isDragOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
