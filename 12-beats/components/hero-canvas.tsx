"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; r: number; vy: number; hue: number; a: number };

/**
 * Animated hero background: a glowing equalizer that breathes to a fake beat,
 * plus drifting particles. Respects `prefers-reduced-motion` (draws one frame).
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bars = 64;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.round(width / 22));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.8 + 0.4,
        vy: -(Math.random() * 0.25 + 0.05),
        hue: Math.random() > 0.5 ? 330 : 260,
        a: Math.random() * 0.6 + 0.2,
      }));
    };

    const drawParticles = () => {
      for (const particle of particles) {
        particle.y += particle.vy;
        if (particle.y < -4) {
          particle.y = height + 4;
          particle.x = Math.random() * width;
        }
        context.beginPath();
        context.fillStyle = `hsla(${particle.hue}, 90%, 70%, ${particle.a})`;
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
      }
    };

    const drawBars = (t: number) => {
      const barWidth = width / bars;
      const base = height * 0.82;
      for (let index = 0; index < bars; index += 1) {
        const position = index / bars;
        const beat = Math.pow(Math.max(0, Math.sin(t * 3.1)), 8) * 0.6;
        const wave = (Math.sin(t * 1.7 + position * 9) + Math.sin(t * 2.9 - position * 13) + 2) / 4;
        const barHeight = height * (0.08 + 0.42 * wave * (0.55 + beat) * (0.35 + 0.65 * Math.sin(position * Math.PI)));
        const gradient = context.createLinearGradient(0, base - barHeight, 0, base);
        gradient.addColorStop(0, "rgba(255,93,143,0.85)");
        gradient.addColorStop(1, "rgba(124,92,255,0.15)");
        context.fillStyle = gradient;
        const x = index * barWidth + barWidth * 0.2;
        const w = barWidth * 0.6;
        context.beginPath();
        if (typeof context.roundRect === "function") {
          context.roundRect(x, base - barHeight, w, barHeight, 4);
        } else {
          context.rect(x, base - barHeight, w, barHeight);
        }
        context.fill();
      }
    };

    const render = (now: number) => {
      const t = (now - start) / 1000;
      context.clearRect(0, 0, width, height);
      drawParticles();
      drawBars(t);
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    resize();
    frame = requestAnimationFrame(render);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 -z-10 h-full w-full" />;
}
