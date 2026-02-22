import React, { useEffect, useRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useConfigStore } from '../../stores/config-store';

interface TerminalTabProps {
  sessionId: string;
  active: boolean;
}

export function TerminalTab({ sessionId, active }: TerminalTabProps) {
  const config = useConfigStore((s) => s.config);
  const { terminalRef, initTerminal, fit, focus } = useTerminal({
    sessionId,
    fontFamily: config.terminal.fontFamily,
    fontSize: config.terminal.fontSize,
  });
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && terminalRef.current) {
      initTerminal();
      initialized.current = true;
    }
  }, [initTerminal]);

  useEffect(() => {
    if (active && initialized.current) {
      // Small delay to allow DOM to update
      requestAnimationFrame(() => {
        fit();
        focus();
      });
    }
  }, [active, fit, focus]);

  return (
    <div ref={terminalRef} className="h-full w-full" />
  );
}
