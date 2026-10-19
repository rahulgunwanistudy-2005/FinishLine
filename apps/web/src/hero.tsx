import { useEffect, useRef, useState } from "react";

export type FigureLane = {
  lane: string;
  number: string;
  status: "finished" | "dnf" | "unknown" | "pending";
  /** Final journey progress, 0–1, taken from the recorded browser events. */
  progress: number;
  /** Share of the slowest lane's estimated time, 0–1. Sets replay pacing. */
  pace: number;
};

type Point = {
  x: number;
  y: number;
  z: number;
  w: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
};

const LANES = 6;
const STRAIGHT = 2.1;
const INNER = 0.82;
const LANE_WIDTH = 0.15;
const REPLAY_MS = 3600;
// Critically damped spring (damping ratio 1, response 0.35 s).
const STIFFNESS = ((2 * Math.PI) / 0.35) ** 2;
const DAMPING = 2 * Math.sqrt(STIFFNESS);

/** Point on a stadium-shaped lap. t = 0 is the start/finish line, front centre. */
function stadium(radius: number, t: number) {
  const perimeter = 2 * STRAIGHT + 2 * Math.PI * radius;
  let d = ((((t % 1) + 1) % 1) * perimeter + STRAIGHT / 2) % perimeter;
  if (d < STRAIGHT) return { x: -STRAIGHT / 2 + d, z: radius };
  d -= STRAIGHT;
  const arc = Math.PI * radius;
  if (d < arc) {
    const a = d / radius;
    return { x: STRAIGHT / 2 + radius * Math.sin(a), z: radius * Math.cos(a) };
  }
  d -= arc;
  if (d < STRAIGHT) return { x: STRAIGHT / 2 - d, z: -radius };
  d -= STRAIGHT;
  const a = Math.min(Math.PI, d / radius);
  return { x: -STRAIGHT / 2 - radius * Math.sin(a), z: -radius * Math.cos(a) };
}

function buildPoints() {
  const points: Point[] = [];
  const add = (x: number, z: number, w = 1) =>
    points.push({ x, y: 0, z, w, ox: 0, oy: 0, vx: 0, vy: 0, sx: 0, sy: 0 });
  // Lane lines.
  for (let i = 0; i <= LANES; i++) {
    const r = INNER + i * LANE_WIDTH;
    const count = Math.round((2 * STRAIGHT + 2 * Math.PI * r) / 0.028);
    for (let k = 0; k < count; k++) {
      const p = stadium(r, k / count);
      add(p.x, p.z, i === 0 || i === LANES ? 1.15 : 0.8);
    }
  }
  // Stippled lane surface, denser towards the outside like a halftone.
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let k = 0; k < 1500; k++) {
    const lane = Math.floor(random() * LANES);
    const r = INNER + (lane + random()) * LANE_WIDTH;
    const p = stadium(r, random());
    add(p.x, p.z, 0.45);
  }
  // Infield, sparse.
  for (let k = 0; k < 420; k++) {
    const r = random() * (INNER - 0.08);
    const p = stadium(r, random());
    add(p.x, p.z, 0.32);
  }
  // Checkered start/finish line across all lanes.
  for (let row = 0; row < 3; row++)
    for (let k = 0; k <= LANES * 6; k++) {
      if ((k + row) % 2) continue;
      const r = INNER + (k / (LANES * 6)) * LANES * LANE_WIDTH;
      add(row * 0.028 - 0.028, r, 1.5);
    }
  return points;
}

export function TrackFigure({
  lanes,
  label,
  replayKey,
}: {
  lanes: FigureLane[];
  label: string;
  replayKey: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = useRef(lanes);
  data.current = lanes;
  const replay = useRef<{ start: number; key: string }>({ start: 0, key: "" });
  const wake = useRef<() => void>(() => {});
  useEffect(() => {
    replay.current = { start: performance.now(), key: replayKey };
    wake.current();
  }, [replayKey]);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const context = node.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const points = buildPoints();
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    const pointer = { x: -9999, y: -9999, inside: false };
    // Parallax tilt is a pair of independent springs (x and y).
    const tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    const resize = () => {
      const rect = node.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      wake.current();
    };
    const project = (x: number, z: number, yaw: number, pitch: number) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = x * cosY - z * sinY;
      const rz = x * sinY + z * cosY;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      // Camera looks down at the infield; the front straight is nearest.
      const y2 = rz * sinP;
      const z2 = -rz * cosP;
      const distance = 6.2;
      const scale = (Math.min(width, height * 1.7) * 0.98) / (distance + z2);
      return {
        x: width / 2 + rx * scale,
        y: height * 0.47 + y2 * scale,
        depth: (distance - z2) / distance,
      };
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
      last = now;
      const style = getComputedStyle(node);
      const ink = style.getPropertyValue("--fig-ink").trim() || "#0a0a0a";
      const finish = style.getPropertyValue("--fig-finish").trim() || "#135a45";
      const stop = style.getPropertyValue("--fig-stop").trim() || "#b42318";
      const unknown =
        style.getPropertyValue("--fig-unknown").trim() || "#9a5b00";
      const still = reduced.matches;
      let moving = false;
      // Tilt springs follow the pointer.
      if (!still) {
        tilt.tx = pointer.inside ? (pointer.x / width - 0.5) * 0.35 : 0;
        tilt.ty = pointer.inside ? (pointer.y / height - 0.5) * 0.12 : 0;
        for (const [p, v, t] of [
          ["x", "vx", "tx"],
          ["y", "vy", "ty"],
        ] as const) {
          const force = STIFFNESS * (tilt[t] - tilt[p]) - DAMPING * tilt[v];
          tilt[v] += force * dt;
          tilt[p] += tilt[v] * dt;
          if (Math.abs(tilt[v]) > 1e-4 || Math.abs(tilt[t] - tilt[p]) > 1e-4)
            moving = true;
        }
      }
      const yaw = 0.1 + tilt.x;
      const pitch = 1.02 + tilt.y;
      context.clearRect(0, 0, width, height);
      context.fillStyle = ink;
      for (const point of points) {
        const p = project(point.x, point.z, yaw, pitch);
        point.sx = p.x;
        point.sy = p.y;
        if (!still) {
          // Each dot springs toward a displaced target, from wherever it is now.
          let tx = 0;
          let ty = 0;
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const radius = 64;
          if (distance < radius && distance > 0.01) {
            const push = (1 - distance / radius) ** 2 * 26;
            tx = (dx / distance) * push;
            ty = (dy / distance) * push;
          }
          const ax = STIFFNESS * (tx - point.ox) - DAMPING * point.vx;
          const ay = STIFFNESS * (ty - point.oy) - DAMPING * point.vy;
          point.vx += ax * dt;
          point.vy += ay * dt;
          point.ox += point.vx * dt;
          point.oy += point.vy * dt;
          if (Math.abs(point.vx) + Math.abs(point.vy) > 0.02) moving = true;
        }
        const size = Math.max(0.6, 1.5 * p.depth * point.w);
        context.globalAlpha = Math.min(1, 0.25 + 0.75 * p.depth) * point.w;
        context.fillRect(
          p.x + point.ox - size / 2,
          p.y + point.oy - size / 2,
          size,
          size,
        );
      }
      context.globalAlpha = 1;
      // Runners replay the recorded result: each lane reaches its measured
      // stopping point at a time proportional to its estimated seconds.
      const elapsed = now - replay.current.start;
      context.font =
        '600 10px "JetBrains Mono Variable", ui-monospace, monospace';
      context.textAlign = "center";
      data.current.forEach((lane, index) => {
        const r = INNER + (index + 0.5) * LANE_WIDTH;
        const duration = Math.max(0.15, lane.pace) * REPLAY_MS;
        const share = still ? 1 : Math.min(1, elapsed / duration);
        const eased = 1 - (1 - share) ** 3;
        if (share < 1) moving = true;
        const progress = lane.progress * eased;
        const spot = stadium(r, Math.min(0.999, progress));
        const p = project(spot.x, spot.z, yaw, pitch);
        const color =
          lane.status === "finished" && share >= 1
            ? finish
            : lane.status === "dnf" && share >= 1
              ? stop
              : lane.status === "unknown" && share >= 1
                ? unknown
                : ink;
        const size = 5.5 * p.depth;
        context.fillStyle = color;
        context.beginPath();
        context.arc(p.x, p.y, size, 0, Math.PI * 2);
        context.fill();
        if (
          share >= 1 &&
          lane.status !== "finished" &&
          lane.status !== "pending"
        ) {
          context.strokeStyle = color;
          context.lineWidth = 1.5;
          context.beginPath();
          context.arc(p.x, p.y, size + 4, 0, Math.PI * 2);
          context.stroke();
        }
        context.fillStyle = ink;
        context.fillText(lane.number, p.x, p.y - size - 6);
      });
      if (moving && visible) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    wake.current = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = true;
      wake.current();
    };
    const leave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
      pointer.inside = false;
      wake.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake.current();
    });
    io.observe(node);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    reduced.addEventListener("change", wake.current);
    resize();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      reduced.removeEventListener("change", wake.current);
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      className="track-figure"
      role="img"
      aria-label={label}
    />
  );
}

export type TerminalLine = {
  kind: "cmd" | "info" | "ok" | "fail" | "warn" | "sum";
  text: string;
  meta?: string;
};

export function Terminal({
  lines,
  title,
  runKey,
}: {
  lines: TerminalLine[];
  title: string;
  runKey: string;
}) {
  const [shown, setShown] = useState(0);
  const total = lines.length;
  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A new run starts typing from the top; live lines keep appending.
  useEffect(() => {
    setShown(reduced() ? total : 0);
  }, [runKey]);
  useEffect(() => {
    if (shown >= total) return;
    if (reduced()) {
      setShown(total);
      return;
    }
    const timer = setTimeout(() => setShown((n) => n + 1), 320);
    return () => clearTimeout(timer);
  }, [shown, total]);
  return (
    <div className="terminal" aria-hidden="true">
      <div className="terminal-bar">
        <span className="terminal-lights">
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
      </div>
      <ol className="terminal-body">
        {lines.slice(0, shown).map((line, index) => (
          <li key={index} className={`t-${line.kind}`}>
            <span className="t-glyph">
              {line.kind === "cmd"
                ? "$"
                : line.kind === "ok"
                  ? "✓"
                  : line.kind === "fail"
                    ? "✕"
                    : line.kind === "warn"
                      ? "?"
                      : line.kind === "sum"
                        ? "■"
                        : "→"}
            </span>
            <span className="t-text">{line.text}</span>
            {line.meta && <span className="t-meta">{line.meta}</span>}
          </li>
        ))}
        <li className="t-cmd t-prompt">
          <span className="t-glyph">$</span>
          <span className="t-cursor" />
        </li>
      </ol>
    </div>
  );
}
