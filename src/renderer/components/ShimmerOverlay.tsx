import { Loader2 } from 'lucide-react';

/** Knuth multiplicative hash for deterministic pseudo-random values per line. */
function hash(seed: number): number {
  let value = seed * 2654435761;
  value = ((value >>> 16) ^ value) * 2246822507;
  value = ((value >>> 16) ^ value) * 3266489909;
  return ((value >>> 16) ^ value) >>> 0;
}

// Pre-compute lines that look like terminal/code output:
// - all flush left-aligned (terminal output is always left-anchored)
// - occasional "blank" lines to simulate paragraph/section breaks
// - widths vary to look like real mixed-length output
const shimmerLines = Array.from({ length: 80 }, (_, index) => {
  const hashValue = hash(index + 42);
  const isBlank = (hashValue % 11) === 0; // ~9% chance of blank line

  return {
    key: index,
    width: isBlank ? 0 : 6 + (hashValue % 34),                 // 6-40%
    delay: ((hashValue >>> 12) % 24) * 0.08,                    // 0-1.84s stagger
    opacity: isBlank ? 0 : 0.18 + ((hashValue >>> 16) % 15) * 0.012, // 0.18-0.35
  };
});

interface ShimmerOverlayProps {
  label: string;
}

/** Full-size loading overlay with shimmer skeleton lines and a glowing status pill.
 *  Used as a placeholder while a terminal session or long-running process is initializing. */
export function ShimmerOverlay({ label }: ShimmerOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface">
      {/* Shimmer skeleton lines: top-left aligned like terminal output, overflow hidden for tall containers */}
      <div className="absolute inset-0 flex flex-col gap-0 pt-2 pl-3 overflow-hidden pointer-events-none">
        {shimmerLines.map((line) => (
          <div
            key={line.key}
            style={{ height: '18px', minHeight: '18px' }}
          >
            {line.width > 0 && (
              <div
                className="terminal-overlay-shimmer-line h-2.5 mt-1"
                style={{
                  width: `${line.width}%`,
                  animationDelay: `${line.delay}s`,
                  opacity: line.opacity,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Glowing pill centered above shimmer lines */}
      <div className="relative z-20 flex items-center gap-2.5 px-6 py-3 rounded-lg bg-accent/20 border border-accent/40 terminal-overlay-glow">
        <Loader2 size={16} className="animate-spin text-accent-fg" />
        <span className="text-base text-accent-fg">{label}</span>
      </div>
    </div>
  );
}
