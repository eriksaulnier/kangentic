import React from 'react';
import { FolderOpen, Columns3, Play } from 'lucide-react';
import { useProjectStore } from '../../stores/project-store';

export function WelcomeScreen() {
  const openProjectByPath = useProjectStore((state) => state.openProjectByPath);

  const handleOpenProject = async () => {
    const selectedPath = await window.electronAPI.dialog.selectFolder();
    if (!selectedPath) return;
    await openProjectByPath(selectedPath);
  };

  return (
    <div className="flex-1 flex items-center justify-center text-fg-faint">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-fg mb-1">Kangentic</h1>
        <p className="text-lg text-fg-muted mb-8">Kanban for Claude Code agents</p>

        <button
          onClick={handleOpenProject}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent-bg text-accent-fg font-medium hover:opacity-90 transition-opacity cursor-pointer"
          data-testid="welcome-open-project"
        >
          <FolderOpen size={20} />
          Open a Project
        </button>

        <div className="mt-10 space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-fg-muted">
              <FolderOpen size={18} />
            </div>
            <div>
              <div className="text-fg text-sm font-medium">Open any code project folder</div>
              <div className="text-fg-faint text-xs">Your project's CLAUDE.md and settings are loaded automatically</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-fg-muted">
              <Columns3 size={18} />
            </div>
            <div>
              <div className="text-fg text-sm font-medium">Create tasks on your Kanban board</div>
              <div className="text-fg-faint text-xs">Organize work into columns with drag-and-drop</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-fg-muted">
              <Play size={18} />
            </div>
            <div>
              <div className="text-fg text-sm font-medium">Drag tasks to agent columns to start sessions</div>
              <div className="text-fg-faint text-xs">Claude Code runs in its own terminal per task</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
