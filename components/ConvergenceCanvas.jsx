"use client";

// The pitch, drawn rather than written.
//
// Seven labelled nodes — the tools a PTS organiser actually juggles — sit
// scattered, then converge onto a single spine and resolve into the event
// lifecycle. Someone understands the product before they've read a sentence.
//
// Driven by a clock, not by scroll. A scroll-scrubbed version only reads if
// someone happens to scroll at the right speed, and it can't play at all for a
// judge who just lands on the page and watches.
//
// Canvas rather than a scroll-scrubbed video frame sequence: the content is
// geometric, so drawing it live costs a few KB instead of ~9MB of preloaded
// JPEGs, stays sharp at any viewport, and can be retuned in a second. Frame
// sequences earn their weight for photoreal renders; this isn't one.

import { useCallback, useEffect, useRef } from "react";

// The scattered state is the problem; the spine is the product. Angles are
// fixed rather than random so the composition is the same every load —
// a hero that reshuffles on refresh reads as noise, not design.
const NODES = [
  { label: "WhatsApp", angle: -2.7, dist: 1.0 },
  { label: "Excel", angle: -1.75, dist: 0.82 },
  { label: "Email", angle: -0.75, dist: 1.0 },
  { label: "giving.sg", angle: 0.15, dist: 0.72 },
  { label: "Notice board", angle: 1.0, dist: 0.95 },
  { label: "Facebook", angle: 2.0, dist: 0.8 },
  { label: "Phone calls", angle: 2.85, dist: 0.92 },
];

const PHASES = ["Plan", "Execute", "Post-event"];

const CYCLE = 8000; // ms — one full pass, then it starts over

// Ease-out — fast commitment, slow settle. The convergence should feel decided
// early and then arrive, not creep the whole way.
const ease = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Where the animation is at a given point in the loop.
 *
 * Deliberately holds at both ends: the scattered state has to be readable
 * before it resolves, and the resolved state is the thing being argued for.
 * A loop that never rests is just movement.
 */
function phaseAt(ms) {
  const t = (ms % CYCLE) / CYCLE;
  if (t < 0.18) return { p: 0, fade: clamp01(t / 0.06) }; // scattered, held
  if (t < 0.46) return { p: ease((t - 0.18) / 0.28), fade: 1 }; // converging
  if (t < 0.9) return { p: 1, fade: 1 }; // resolved, held
  return { p: 1, fade: clamp01((1 - t) / 0.06) }; // fade out, restart
}

export default function ConvergenceCanvas() {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const runningRef = useRef(false);

  const paint = useCallback((progress, fade) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width: w, height: h } = canvas.getBoundingClientRect();

    // Palette comes from the app's own tokens, so the landing page can never
    // drift away from the console it introduces.
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#16302a";
    const muted = css.getPropertyValue("--muted").trim() || "#4b655f";
    const accent = css.getPropertyValue("--accent").trim() || "#c97a1e";
    const font = css.getPropertyValue("--font-sans").trim() || "sans-serif";

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    const t = progress;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.38;
    // The resolved spine spans most of the width but never touches the edges.
    const spineHalf = Math.min(w * 0.36, 380);

    const points = NODES.map((n, i) => {
      const sx = cx + Math.cos(n.angle) * radius * n.dist;
      const sy = cy + Math.sin(n.angle) * radius * n.dist * 0.62;
      const rx = cx - spineHalf + (i / (NODES.length - 1)) * spineHalf * 2;
      return { x: lerp(sx, rx, t), y: lerp(sy, cy, t), label: n.label };
    });

    // Each node keeps a thread back to where everything is heading. The
    // threads are the whole argument — five places, one destination — so they
    // exist from the first frame rather than arriving at the end.
    ctx.lineWidth = 1;
    points.forEach((p) => {
      ctx.strokeStyle = accent;
      // Faint while scattered, confident once they've landed.
      ctx.globalAlpha = fade * lerp(0.18, 0.5, t);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    });

    // The spine draws itself as the nodes arrive — the line IS the product,
    // so it shouldn't exist until the convergence has earned it.
    if (t > 0.15) {
      const reach = (t - 0.15) / 0.85;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = fade * 0.28;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - spineHalf, cy);
      ctx.lineTo(cx - spineHalf + spineHalf * 2 * reach, cy);
      ctx.stroke();
    }

    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      // Scattered nodes are grey problems; resolved ones are the product.
      ctx.fillStyle = t > 0.6 ? accent : muted;
      ctx.globalAlpha = fade;
      ctx.fill();

      ctx.font = `500 13px ${font}`;
      ctx.fillStyle = muted;
      ctx.textAlign = "center";
      // Labels fade as the tools stop being separate places to look.
      ctx.globalAlpha = fade * Math.max(0, 1 - t * 1.5);
      ctx.fillText(p.label, p.x, p.y - 14);
    });

    // The lifecycle only names itself once the convergence has happened.
    ctx.globalAlpha = fade * clamp01((t - 0.55) / 0.35);
    ctx.font = `600 15px ${font}`;
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    PHASES.forEach((label, i) => {
      const x = cx - spineHalf + (i / (PHASES.length - 1)) * spineHalf * 2;
      ctx.fillText(label, x, cy + 34);
    });
    ctx.globalAlpha = 1;
  }, []);

  // Canvas needs its backing store sized in device pixels or everything is
  // soft on a retina screen — the one detail that makes canvas look cheap.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resize();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Someone who asked for less movement still gets the point — just the
      // resolved state, held still.
      paint(1, 1);
      window.addEventListener("resize", () => {
        resize();
        paint(1, 1);
      });
      return;
    }

    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      const { p, fade } = phaseAt(now - startRef.current);
      paint(p, fade);
      rafRef.current = requestAnimationFrame(tick);
    };

    // Only animate while it's on screen. A canvas repainting behind three
    // screens of scrolled-past content is pure battery burn.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !runningRef.current) {
          runningRef.current = true;
          rafRef.current = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && runningRef.current) {
          runningRef.current = false;
          cancelAnimationFrame(rafRef.current);
        }
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [paint, resize]);

  return (
    <canvas
      ref={canvasRef}
      className="lp-canvas"
      role="img"
      aria-label="Seven scattered coordination tools — WhatsApp, Excel, email, giving.sg, notice boards, Facebook and phone calls — converging into a single event lifecycle: plan, execute, post-event."
    />
  );
}
