import { expect, it, vi } from "vitest";
import { shakerTextureCurve } from "./shaker-texture";

function peaks(curve: Float32Array): number[] {
  return Array.from(curve.keys()).filter((i) => i > 0 && i < curve.length - 1 && curve[i] > curve[i - 1] && curve[i] >= curve[i + 1]);
}

it("bypasses texture at zero depth and scales depth without amplifying the noise", () => {
  const full = shakerTextureCurve(1, 60, 0.3, 42);
  const half = shakerTextureCurve(0.5, 60, 0.3, 42);
  expect(shakerTextureCurve(0, 60, 0.3, 42).every((value) => value === 1)).toBe(true);
  full.forEach((value, i) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
    expect(half[i]).toBeCloseTo(0.5 + value / 2, 6);
  });
});

it.each([20, 60, 120])("produces the requested %s Hz density with varying crest positions and levels", (rate) => {
  const curve = shakerTextureCurve(1, rate, 0.5, 19);
  const indices = peaks(curve);
  expect(indices).toHaveLength(rate / 2);
  const heights = indices.map((i) => curve[i]);
  const gaps = indices.slice(1).map((i, n) => i - indices[n]);
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.1);
  expect(new Set(gaps).size).toBeGreaterThan(1);
  expect(peaks(shakerTextureCurve(1, rate, 1, 19))).toHaveLength(rate);
});

it("varies by seed without touching the random stream used by rhythm decisions", () => {
  const random = vi.spyOn(Math, "random");
  try {
    expect(shakerTextureCurve(1, 60, 0.5, 19)).toEqual(shakerTextureCurve(1, 60, 0.5, 19));
    expect(shakerTextureCurve(1, 60, 0.5, 20)).not.toEqual(shakerTextureCurve(1, 60, 0.5, 19));
    expect(random).not.toHaveBeenCalled();
  } finally { random.mockRestore(); }
});

it.each([0.006, 0.045, 1.44])("keeps work and gain bounded for a %s-second shake", (duration) => {
  for (const rate of [20, 120]) {
    const curve = shakerTextureCurve(1, rate, duration, 0xffffffff);
    expect(curve).toHaveLength(1024);
    expect(curve.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  }
});
