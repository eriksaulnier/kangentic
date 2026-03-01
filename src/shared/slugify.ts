/**
 * Turn a string into a filesystem-safe slug.
 * e.g. "Fix login bug (urgent!)" → "fix-login-bug-urgent"
 */
export function slugify(text: string, maxLen = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/, '');
}
