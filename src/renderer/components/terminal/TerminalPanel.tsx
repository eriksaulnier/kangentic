import React, { useEffect, useCallback } from 'react';
import { useSessionStore } from '../../stores/session-store';
import { TerminalTab } from './TerminalTab';

export function TerminalPanel() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const activeSessions = sessions.filter((s) => s.status !== 'exited' || s.exitCode !== null);

  useEffect(() => {
    // Auto-select first session if none active
    if (!activeSessionId && activeSessions.length > 0) {
      setActiveSession(activeSessions[0].id);
    }
  }, [activeSessions.length]);

  if (activeSessions.length === 0) {
    return (
      <div className="h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-sm">
        No active sessions. Drag a task to a column with a spawn_agent skill to start one.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Tab bar */}
      <div className="flex items-center border-b border-zinc-700 overflow-x-auto flex-shrink-0">
        {activeSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-zinc-700 transition-colors whitespace-nowrap ${
              activeSessionId === session.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${
              session.status === 'running' ? 'bg-green-400' :
              session.status === 'queued' ? 'bg-yellow-400' :
              'bg-zinc-500'
            }`} />
            {session.taskId.slice(0, 8)}
          </button>
        ))}
      </div>

      {/* Active terminal */}
      <div className="flex-1 min-h-0">
        {activeSessions.map((session) => (
          <div
            key={session.id}
            className={activeSessionId === session.id ? 'h-full' : 'hidden'}
          >
            <TerminalTab sessionId={session.id} active={activeSessionId === session.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
