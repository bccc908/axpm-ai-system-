"use client";

import { useEffect, useRef } from "react";
import { mountQuietSignal } from "@/components/auth/quiet-signal-scene";

export function QuietSignalBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountQuietSignal(canvas);
  }, []);

  return (
    <div className="tech-bg" aria-hidden="true">
      <div className="tech-bg-base" />
      <div className="tech-bg-orbs" />
      <div className="tech-bg-grid" />
      <canvas ref={canvasRef} className="tech-bg-canvas" />
      <div className="tech-bg-vignette" />
    </div>
  );
}
