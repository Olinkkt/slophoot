"use client";
import { useEffect, useState } from "react";
export const COLORS = ["bg-red-600", "bg-blue-600", "bg-yellow-500", "bg-green-600"];
export const SHAPES = ["▲", "◆", "●", "■"];

export function TimerBar({ ms, total, k }: { ms: number; total: number; k: unknown }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    setGo(false);
    const h = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    return () => cancelAnimationFrame(h);
  }, [k, ms]);
  return (
    <div className="h-3 overflow-hidden rounded-full bg-white/15">
      <div className="h-full rounded-full bg-yellow-400"
        style={{ width: go ? "0%" : `${Math.min(100, (ms / (total * 1000)) * 100)}%`, transition: go ? `width ${ms}ms linear` : "none" }} />
    </div>
  );
}
