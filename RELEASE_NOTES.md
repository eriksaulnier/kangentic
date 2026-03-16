## What's New
- Task search bar for filtering tasks across all columns (Ctrl+F)
- Completed Tasks dialog with sortable data table for reviewing finished work
- Redesigned Done column with capped preview and quick access to completed tasks
- Switch base branch or enable worktree on existing tasks (no longer locked at creation)
- "Add task" button now only appears in Backlog for a cleaner board layout
- Settings tab sidebar now shows muted Project/System section headers for clarity
- `/pull-request` command for creating PRs directly from the board
- `npx kangentic --demo` flag for trying Kangentic without a real project

## Bug Fixes
- Fixed duplicated terminal output when resuming a session
- Fixed terminal panel collapse/expand and drag-resize misbehavior
- Fixed session metrics not captured when suspending from auto_spawn=false or auto_command columns
- Fixed task detail dialog staying open after save instead of closing
- Fixed completed date wrapping in the Done column data table
- Fixed unnecessary kangentic.json rewrites when content hasn't changed
- Fixed timeline and duration calculations to start from task creation and aggregate across sessions

## Performance
- Optimized drag-and-drop rendering for smooth 60fps interaction
