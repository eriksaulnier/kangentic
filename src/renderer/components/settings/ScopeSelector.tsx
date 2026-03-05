import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderOpen, Globe } from 'lucide-react';
import type { SettingsScope } from '../../stores/config-store';
import type { Project } from '../../../shared/types';

interface ScopeSelectorProps {
  scope: SettingsScope;
  scopeProjectPath: string | null;
  projects: Project[];
  onSelectGlobal: () => void;
  onSelectProject: (projectId: string, projectPath: string) => void;
}

export function ScopeSelector({ scope, scopeProjectPath, projects, onSelectGlobal, onSelectProject }: ScopeSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const isProjectScope = scope === 'project';
  const scopeProject = isProjectScope
    ? projects.find((project) => project.path === scopeProjectPath)
    : null;
  const scopeLabel = isProjectScope ? (scopeProject?.name ?? 'Project') : 'Global';
  const ScopeIcon = isProjectScope ? FolderOpen : Globe;

  return (
    <div className="relative" ref={chipRef} data-testid="scope-selector">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors ${
          dropdownOpen
            ? 'border-accent text-accent-fg bg-accent/10'
            : 'border-edge-input text-fg-muted hover:text-fg-secondary hover:border-fg-faint'
        }`}
        data-testid="scope-chip"
      >
        <ScopeIcon size={13} />
        {scopeLabel}
        <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-max bg-surface-raised border border-edge rounded-lg shadow-lg z-10 py-1">
          <button
            onClick={() => { onSelectGlobal(); setDropdownOpen(false); }}
            className="w-full px-3 py-2 text-sm cursor-pointer hover:bg-surface-hover flex items-center gap-2 text-left whitespace-nowrap"
            data-testid="scope-option-global"
          >
            <Globe size={14} className="flex-shrink-0" />
            <span className={scope === 'global' ? 'text-accent-fg' : 'text-fg'}>Global</span>
            {scope === 'global' && <Check size={14} className="ml-auto text-accent-fg flex-shrink-0" />}
          </button>
          {projects.map((project) => {
            const isSelected = isProjectScope && scopeProjectPath === project.path;
            return (
              <button
                key={project.id}
                onClick={() => { onSelectProject(project.id, project.path); setDropdownOpen(false); }}
                className="w-full px-3 py-2 text-sm cursor-pointer hover:bg-surface-hover flex items-center gap-2 text-left whitespace-nowrap"
                data-testid={`scope-option-${project.id}`}
              >
                <FolderOpen size={14} className="flex-shrink-0" />
                <span className={isSelected ? 'text-accent-fg' : 'text-fg'}>{project.name}</span>
                {isSelected && <Check size={14} className="ml-auto text-accent-fg flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
