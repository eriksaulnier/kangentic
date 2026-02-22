import React from 'react';
import { useProjectStore } from '../../stores/project-store';
import { useConfigStore } from '../../stores/config-store';

interface TitleBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TitleBar({ sidebarOpen, onToggleSidebar }: TitleBarProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);
  const settingsOpen = useConfigStore((s) => s.settingsOpen);

  return (
    <div className="h-9 bg-zinc-900 border-b border-zinc-700 flex items-center px-3 select-none flex-shrink-0"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onToggleSidebar}
          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="3" width="12" height="1.5" rx="0.5" />
            <rect x="2" y="7" width="12" height="1.5" rx="0.5" />
            <rect x="2" y="11" width="12" height="1.5" rx="0.5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 text-center text-sm text-zinc-400">
        <span className="font-semibold text-zinc-200">Kangentic</span>
        {currentProject && (
          <span className="ml-2 text-zinc-500">
            &mdash; {currentProject.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 10a2 2 0 100-4 2 2 0 000 4zM13.3 7l.9-.5c.2-.1.3-.4.2-.6l-1-1.7c-.1-.2-.4-.3-.6-.2l-.9.5a5 5 0 00-1-.6V3c0-.3-.2-.5-.5-.5h-2c-.3 0-.5.2-.5.5v1a5 5 0 00-1 .5l-.9-.5c-.2-.1-.5 0-.6.2l-1 1.7c-.1.2 0 .5.2.6l.9.5a5 5 0 000 1.2l-.9.5c-.2.1-.3.4-.2.6l1 1.7c.1.2.4.3.6.2l.9-.5a5 5 0 001 .6v1c0 .3.2.5.5.5h2c.3 0 .5-.2.5-.5v-1a5 5 0 001-.6l.9.5c.2.1.5 0 .6-.2l1-1.7c.1-.2 0-.5-.2-.6l-.9-.5c.1-.4.1-.8 0-1.2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
