# Documentation Maintenance

Contextual knowledge for keeping `docs/` in sync with source code.

## Source-to-Doc Mapping

Each doc file and the source files that are its authority:

| Doc | Primary Source Files |
|-----|---------------------|
| `architecture.md` | `src/shared/ipc-channels.ts`, `src/preload/preload.ts`, `src/renderer/stores/`, `src/main/pty/session-manager.ts` |
| `session-lifecycle.md` | `src/main/pty/session-manager.ts`, `src/main/pty/session-queue.ts`, `src/main/engine/session-recovery.ts` |
| `configuration.md` | `src/shared/types.ts` (AppConfig, DEFAULT_CONFIG, GLOBAL_ONLY_PATHS), `src/main/config/config-manager.ts` |
| `claude-integration.md` | `src/main/agent/command-builder.ts`, `src/main/agent/hook-manager.ts`, `src/main/agent/trust-manager.ts`, `src/main/agent/claude-detector.ts` |
| `transition-engine.md` | `src/main/engine/transition-engine.ts`, `src/shared/types.ts` (ActionType, ActionConfig) |
| `database.md` | `src/main/db/migrations.ts`, `src/main/db/database.ts`, `src/main/db/repositories/*.ts` |
| `cross-platform.md` | `src/main/pty/shell-resolver.ts`, `forge.config.ts`, `scripts/build.js` |
| `worktree-strategy.md` | `src/main/git/worktree-manager.ts`, `src/main/agent/hook-manager.ts`, `src/main/agent/trust-manager.ts` |
| `activity-detection.md` | `src/main/agent/event-bridge.js`, `src/shared/types.ts` (EventType, EventTypeActivity, HookEvent) |
| `overview.md` | `README.md`, high-level features |
| `user-guide.md` | `src/renderer/components/`, `src/renderer/stores/`, `src/shared/types.ts` |
| `developer-guide.md` | `scripts/`, `tests/`, `forge.config.ts`, `package.json` |
| `docs/README.md` | All other docs (index) |

## Doc Conventions

- Flat structure in `docs/` -- no subdirectories
- Each doc has a clear H1 title and opening paragraph stating purpose
- Cross-reference other docs with relative links (`[Title](filename.md)`)
- Technical docs include "See Also" sections at the bottom
- No emojis
- Tables for structured data (schema, config keys, constants)
- Code blocks for CLI commands and file structures

## When to Create a New Doc

- A new major subsystem is added (new directory under `src/main/`)
- An existing doc exceeds ~500 lines and covers two distinct topics
- A new integration point is added (new agent type, new build target)

## When to Delete a Doc

- The subsystem it documents has been removed entirely
- Its content has been fully merged into another doc
- Always update `docs/README.md` and `README.md` when adding/removing

## Categories of Drift

When auditing docs, check for these types of staleness:

- Schema changes (new/removed/renamed columns in migrations)
- New or removed config keys (DEFAULT_CONFIG, GLOBAL_ONLY_PATHS)
- Changed constants (action types, event types, IPC channels)
- Renamed types or interfaces
- Changed hook events or bridge script behavior
- Altered shell detection order or platform-specific logic
- Updated IPC channels or preload bridge methods
- New or removed CLI flags in command builder
