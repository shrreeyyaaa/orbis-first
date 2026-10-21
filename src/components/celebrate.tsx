"use client";
import { useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";

const COLORS = ["#C29A4E", "#1A2C4E", "#2E7D5B", "#8C3B4A", "#3E7C86", "#8A9A5B"];

/**
 * Lightweight, CSS-only celebration: a burst of confetti plus a centered toast.
 * Render with a non-null `title` to trigger; calls `onDone` after the animation.
 */
export function Celebration({
  title,
  description,
  onDone,
}: {
  title: string | null;
  description?: string;
  onDone: () => void;
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [title],
  );

  useEffect(() => {
    if (!title) return;
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [title, onDone]);

  if (!title) return null;

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[101] flex justify-center px-4">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-lg">
          <div className="rounded-lg bg-gold/15 p-2 text-gold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif text-base font-semibold">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
