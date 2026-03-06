---
description: Review and update documentation to match current source code
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git:*)
---

# Update Docs

Review and update `docs/` to match the current source code. Uses the source-to-doc mapping from `.claude/skills/docs-maintenance/SKILL.md`.

## Step 1 -- Scope Detection

Determine what source files changed:

1. Check if on a branch with unpushed commits:
   - Run `git log origin/HEAD..HEAD --name-only --pretty=format:""` to get changed files
   - If that fails, run `git diff --name-only HEAD~1` as fallback
2. Filter to source files only (exclude `docs/`, `.claude/`, `tests/`)
3. Map changed source files to affected docs using the source-to-doc mapping in the skill
4. If no source files changed (docs-only or config-only commit), report "No source changes detected -- skipping doc review" and stop

## Step 2 -- Doc Audit

For each affected doc:

1. Read the doc file
2. Read the source files it references (from the mapping)
3. Check for staleness -- do code details in the doc still match the source?
4. Look for:
   - Schema changes (columns, tables, migrations)
   - New/removed config keys or default values
   - Changed constants (action types, event types, IPC channels)
   - Renamed types or interfaces
   - Changed hook events or bridge script behavior
   - Altered shell detection order
   - New/removed CLI flags
   - Changed function signatures or behavior

## Step 3 -- Update Pass

For each doc with stale content:

1. Update stale facts (numbers, type names, default values, column lists, etc.)
2. Add sections for significant new features not yet documented
3. Remove sections for removed features
4. Update cross-references if docs were added/removed
5. Update `docs/README.md` index if docs were added/removed

**Constraints:**
- Only edit files in `docs/` and `README.md` (Documentation section only)
- Never modify source code, tests, or config files
- Respect the single-command Bash rule

## Step 4 -- Structural Review

Check overall doc health:

1. Verify all internal links between docs resolve (no broken `[text](file.md)` links)
2. Check that `docs/README.md` lists all docs in `docs/`
3. Check that the `README.md` Documentation section is current
4. Flag any doc over 500 lines that could benefit from splitting

## Step 5 -- Report

Summarize what was done:

- List of docs updated with brief change descriptions
- List of docs created or deleted (if any)
- Any items that need human review (ambiguous changes, major restructuring)
- "No changes needed" if everything is current
