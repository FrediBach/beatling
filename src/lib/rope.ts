export interface Point { x: number; y: number }
export interface RopePoint extends Point { previousX: number; previousY: number }
export interface Rope {
  points: RopePoint[];
  start: Point;
  end: Point;
  segmentLength: number;
}
export interface Rectangle { left: number; top: number; right: number; bottom: number }

export const ROPE_STEP = 1 / 120;

export function createRope(start: Point, end: Point, bottom?: number): Rope {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const desiredLength = distance + Math.min(100, Math.max(30, distance * 0.16));
  // Shorten cables near the bottom edge so the hanging loop fits the rack.
  // Reflect an endpoint across the bottom to bound the length reaching that edge.
  const availableLength = bottom === undefined ? Infinity : Math.hypot(end.x - start.x, 2 * bottom - start.y - end.y);
  const length = Math.min(desiredLength, Math.max(distance + 1, availableLength));
  const segments = 24;
  const points = Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const sag = Math.sin(t * Math.PI);
    // A little sideways slack breaks the symmetry of vertically aligned jacks.
    const x = start.x + (end.x - start.x) * t + sag * 12;
    const y = start.y + (end.y - start.y) * t + sag * Math.min(70, length * 0.2);
    return { x, y, previousX: x, previousY: y };
  });
  return { points, start: { ...start }, end: { ...end }, segmentLength: length / segments };
}

/** Fixed-step Verlet integration with pinned ends and inextensible distance constraints. */
export function stepRope(rope: Rope): number {
  const { points, start, end, segmentLength } = rope;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const velocityX = (point.x - point.previousX) * 0.985;
    const velocityY = (point.y - point.previousY) * 0.985;
    point.previousX = point.x;
    point.previousY = point.y;
    point.x += velocityX;
    point.y += velocityY + 1100 * ROPE_STEP * ROPE_STEP;
  }
  Object.assign(points[0], start);
  Object.assign(points[points.length - 1], end);
  for (let iteration = 0; iteration < 32; iteration++) {
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index];
      const b = points[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.00001) continue;
      const correction = (distance - segmentLength) / distance;
      const aWeight = index === 0 ? 0 : index === points.length - 2 ? 1 : 0.5;
      const bWeight = index === points.length - 2 ? 0 : index === 0 ? 1 : 0.5;
      a.x += dx * correction * aWeight;
      a.y += dy * correction * aWeight;
      b.x -= dx * correction * bWeight;
      b.y -= dy * correction * bWeight;
    }
  }
  return Math.max(...points.slice(1, -1).map((point) => Math.hypot(point.x - point.previousX, point.y - point.previousY)));
}

/** Segment/rectangle clipping catches crossings even when no rope vertex is inside. */
export function ropeOverlaps(rope: Rope, rect: Rectangle, padding = 5): boolean {
  return rope.points.slice(1).some((b, index) => {
    const a = rope.points[index];
    let near = 0;
    let far = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edges = [
      [-dx, a.x - rect.left + padding], [dx, rect.right + padding - a.x],
      [-dy, a.y - rect.top + padding], [dy, rect.bottom + padding - a.y],
    ];
    for (const [direction, distance] of edges) {
      if (direction === 0) {
        if (distance < 0) return false;
      } else if (direction < 0) near = Math.max(near, distance / direction);
      else far = Math.min(far, distance / direction);
      if (near > far) return false;
    }
    return true;
  });
}
