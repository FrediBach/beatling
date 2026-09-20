import { memo, useEffect, useRef } from "react";
import { cablePort, cableSignal } from "@/lib/cables";
import type { Connection } from "@/lib/routing";
import { createRope, ROPE_STEP, ropeOverlaps, stepRope, type Rectangle, type Rope } from "@/lib/rope";

interface Cable { rope: Rope; color: string; opacity: number; quietSteps: number }

export const PatchCables = memo(function PatchCables({ connections }: { connections: Connection[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cablesRef = useRef(new Map<string, Cable>());

  useEffect(() => {
    const canvas = canvasRef.current;
    const grid = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !grid || !context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastTime = 0;
    let accumulator = 0;
    let width = 0;
    let height = 0;
    let hovered: Element | null = grid.querySelector("[data-block-index]:hover");
    let focused: Element | null = document.activeElement?.closest("[data-block-index]") ?? null;
    const bounds = new Map<Element, Rectangle>();
    let cables: Cable[] = [];

    function draw(time: number) {
      frame = 0;
      if (document.hidden) { lastTime = 0; return; }
      const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : ROPE_STEP;
      lastTime = time;
      accumulator += elapsed;
      while (accumulator >= ROPE_STEP) {
        for (const cable of cables) {
          if (cable.quietSteps < 30) cable.quietSteps = stepRope(cable.rope) < 0.015 ? cable.quietSteps + 1 : 0;
        }
        accumulator -= ROPE_STEP;
      }
      context!.clearRect(0, 0, width, height);
      const activeRects = [hovered, focused].flatMap((element) => element && bounds.has(element) ? [bounds.get(element)!] : []);
      let moving = false;
      for (const cable of cables) {
        const target = activeRects.some((rect) => ropeOverlaps(cable.rope, rect)) ? 0 : 1;
        cable.opacity += (target - cable.opacity) * (motion.matches ? 1 : 1 - Math.exp(-elapsed * 24));
        if (Math.abs(target - cable.opacity) < 0.005) cable.opacity = target;
        moving ||= cable.quietSteps < 30 || cable.opacity !== target;
        if (cable.opacity > 0) paintCable(context!, cable);
      }
      if (moving) frame = requestAnimationFrame(draw);
      else lastTime = 0;
    }

    function wake() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function measure() {
      const rect = grid!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      bounds.clear();
      grid!.querySelectorAll<HTMLElement>("[data-block-index]").forEach((block) => {
        const box = block.getBoundingClientRect();
        bounds.set(block, { left: box.left - rect.left, top: box.top - rect.top, right: box.right - rect.left, bottom: box.bottom - rect.top });
      });
      const next = new Map<string, Cable>();
      for (const connection of connections) {
        const anchors = (["source", "target"] as const).map((end) => {
          const port = grid!.querySelector(`[data-block-index="${connection[end]}"] [data-cable-port="${cablePort(connection, end)}"]`);
          if (!port) return null;
          const box = port.getBoundingClientRect();
          return { x: box.left + box.width / 2 - rect.left, y: box.top + box.height / 2 - rect.top };
        });
        const [start, end] = anchors;
        if (!start || !end) continue;
        const key = `${connection.source}-${connection.target}-${connection.input}`;
        let cable = cablesRef.current.get(key);
        if (!cable || Math.hypot(cable.rope.start.x - start.x, cable.rope.start.y - start.y, cable.rope.end.x - end.x, cable.rope.end.y - end.y) > 0.5) {
          cable = { rope: createRope(start, end, height - 10), color: cableSignal(connection).color, opacity: 1, quietSteps: 0 };
          // Begin with slack already hanging; reduced motion settles below.
          if (!motion.matches) for (let step = 0; step < 60; step++) stepRope(cable.rope);
        }
        if (motion.matches) {
          for (let step = 0; step < 1200 && cable.quietSteps < 30; step++) cable.quietSteps = stepRope(cable.rope) < 0.015 ? cable.quietSteps + 1 : 0;
          cable.quietSteps = 30;
        }
        next.set(key, cable);
      }
      cablesRef.current = next;
      cables = [...next.values()];
      wake();
    }

    const blockAt = (target: EventTarget | null) => target instanceof Element ? target.closest("[data-block-index]") : null;
    const onPointerOver = (event: PointerEvent) => { hovered = blockAt(event.target); wake(); };
    const onPointerOut = (event: PointerEvent) => { hovered = blockAt(event.relatedTarget); wake(); };
    const onPointerLeave = () => { hovered = null; wake(); };
    const onFocusIn = (event: FocusEvent) => { focused = blockAt(event.target); wake(); };
    const onFocusOut = (event: FocusEvent) => { focused = blockAt(event.relatedTarget); wake(); };
    const onVisibility = () => { lastTime = 0; wake(); };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.querySelectorAll("[data-block-index]").forEach((block) => observer.observe(block));
    grid.addEventListener("pointerover", onPointerOver);
    grid.addEventListener("pointerout", onPointerOut);
    grid.addEventListener("pointerleave", onPointerLeave);
    grid.addEventListener("focusin", onFocusIn);
    grid.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      grid.removeEventListener("pointerover", onPointerOver);
      grid.removeEventListener("pointerout", onPointerOut);
      grid.removeEventListener("pointerleave", onPointerLeave);
      grid.removeEventListener("focusin", onFocusIn);
      grid.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", measure);
    };
  }, [connections]);

  return <canvas ref={canvasRef} className="patch-cables" aria-hidden="true" data-testid="patch-cables" style={{ pointerEvents: "none" }} />;
});

function paintCable(context: CanvasRenderingContext2D, cable: Cable) {
  const points = cable.rope.points;
  context.save();
  context.globalAlpha = cable.opacity;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }
  context.lineTo(points.at(-1)!.x, points.at(-1)!.y);
  context.shadowColor = "#0007";
  context.shadowBlur = 3;
  context.shadowOffsetY = 3;
  context.strokeStyle = "#202421";
  context.lineWidth = 5.5;
  context.stroke();
  context.shadowColor = "transparent";
  context.shadowOffsetY = 0;
  context.strokeStyle = cable.color;
  context.lineWidth = 3.8;
  context.stroke();
  context.strokeStyle = "#ffffff50";
  context.lineWidth = 1;
  context.stroke();
  for (const [end, neighbor] of [[points[0], points[1]], [points.at(-1)!, points.at(-2)!]]) {
    const angle = Math.atan2(neighbor.y - end.y, neighbor.x - end.x);
    context.save();
    context.translate(end.x, end.y);
    context.rotate(angle);
    context.fillStyle = "#202421";
    context.beginPath();
    context.roundRect(-3, -4, 12, 8, 2);
    context.fill();
    context.fillStyle = "#bcc2bf";
    context.fillRect(-2, -3, 3, 6);
    context.fillStyle = cable.color;
    context.fillRect(3, -3, 3, 6);
    context.restore();
  }
  context.restore();
}
