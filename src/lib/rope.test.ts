import { describe, expect, it } from "vitest";
import { createRope, ropeOverlaps, stepRope } from "./rope";

describe("Verlet patch ropes", () => {
  it("settles under gravity with pinned endpoints and nearly constant segment lengths", () => {
    const rope = createRope({ x: 20, y: 40 }, { x: 320, y: 40 });
    let movement = 0;
    for (let step = 0; step < 1800; step++) movement = stepRope(rope);
    expect(rope.points[0]).toMatchObject(rope.start);
    expect(rope.points.at(-1)).toMatchObject(rope.end);
    expect(rope.points[12].y).toBeGreaterThan(100);
    expect(movement).toBeLessThan(0.015);
    for (let index = 1; index < rope.points.length; index++) {
      const a = rope.points[index - 1];
      const b = rope.points[index];
      expect(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - rope.segmentLength)).toBeLessThan(0.15);
    }
  });

  it.each([
    [{ x: 20, y: 400 }, { x: 20, y: 20 }],
    [{ x: 20, y: 20 }, { x: 20, y: 20 }],
    [{ x: 800, y: 40 }, { x: 10, y: 1000 }],
  ])("keeps vertical, coincident and long diagonal routes finite", (start, end) => {
    const rope = createRope(start, end);
    for (let step = 0; step < 600; step++) stepRope(rope);
    expect(rope.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    expect(rope.points[0]).toMatchObject(start);
    expect(rope.points.at(-1)).toMatchObject(end);
  });

  it("detects crossings of unrelated blocks, including between rope vertices", () => {
    const rope = createRope({ x: 0, y: 50 }, { x: 200, y: 50 });
    rope.points = [rope.points[0], rope.points.at(-1)!];
    expect(ropeOverlaps(rope, { left: 90, top: 20, right: 110, bottom: 80 })).toBe(true);
    expect(ropeOverlaps(rope, { left: 90, top: 80, right: 110, bottom: 120 })).toBe(false);
    expect(ropeOverlaps(rope, { left: 250, top: 20, right: 280, bottom: 80 })).toBe(false);
  });

  it.each([
    [{ x: 100, y: 710 }, { x: 1250, y: 708 }],
    [{ x: 100, y: 30 }, { x: 1250, y: 710 }],
  ])("keeps long cables near the bottom visible throughout settling", (start, end) => {
    const bottom = 734;
    const rope = createRope(start, end, bottom);
    expect(Math.max(...rope.points.map((point) => point.y))).toBeLessThanOrEqual(bottom);
    for (let step = 0; step < 1200; step++) {
      stepRope(rope);
      expect(Math.max(...rope.points.map((point) => point.y))).toBeLessThanOrEqual(bottom);
    }
    expect(rope.points[0]).toMatchObject(start);
    expect(rope.points.at(-1)).toMatchObject(end);
  });
});
