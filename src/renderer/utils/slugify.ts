import { slugify as sharedSlugify } from '../../shared/slugify';

/** Max characters for a tab/badge label */
const MAX_SLUG_LENGTH = 18;

/**
 * Convert a task title into a short, readable slug for terminal tabs and
 * aggregate badges.  e.g. "Fix lint errors in auth" → "fix-lint-errors-in"
 */
export function slugify(title: string): string {
  return sharedSlugify(title, MAX_SLUG_LENGTH);
}
