import { useRef, useEffect, useCallback } from 'react';

/**
 * Tracks a value and applies a transient CSS class when it changes.
 * Skips the initial mount so the pulse only fires on updates.
 * Returns a ref callback to attach to the target element.
 */
export function useValuePulse<T>(value: T, className = 'animate-value-update', durationMs = 350) {
  const elRef = useRef<HTMLElement | null>(null);
  const prevRef = useRef<T>(value);
  const mountedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (value === prevRef.current) return;
    prevRef.current = value;

    const el = elRef.current;
    if (!el) return;

    // Cancel any pending animation so rapid changes restart cleanly
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    el.classList.remove(className);
    rafRef.current = requestAnimationFrame(() => {
      el.classList.add(className);
      timerRef.current = setTimeout(() => el.classList.remove(className), durationMs);
    });
  }, [value, className, durationMs]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const setRef = useCallback((node: HTMLElement | null) => {
    elRef.current = node;
  }, []);

  return setRef;
}
