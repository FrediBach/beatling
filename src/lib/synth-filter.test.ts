import { expect, it } from "vitest";
import { synthFilterSweep, type FilterPoint } from "./synth-filter";

const C3 = 440 * 2 ** ((48 - 69) / 12);
const base = { start: 1, duration: 0.2, peak: 2000, resting: 500, from: C3, target: C3, glideEnd: 1, tracking: 1, ceiling: 15680 };

function sample(points: FilterPoint[], time: number): number {
  const next = points.findIndex((point) => point.time > time);
  if (next < 0) return points.at(-1)!.frequency;
  if (next === 0) return points[0].frequency;
  const a = points[next - 1];
  const b = points[next];
  return a.frequency * (b.frequency / a.frequency) ** ((time - a.time) / (b.time - a.time));
}

it("preserves exact legacy endpoints and ignores glide when tracking is disabled", () => {
  expect(synthFilterSweep({ ...base, tracking: 0, from: C3 / 4, target: C3 * 4, glideEnd: 1.5 })).toEqual([
    { time: 1, frequency: 2000 }, { time: 1.2, frequency: 500 },
  ]);
});

it.each([0.5, 1, 2, 4])("tracks pitch ratio %s with full and half tracking", (ratio) => {
  for (const tracking of [0.5, 1]) {
    const points = synthFilterSweep({ ...base, from: C3 * ratio, target: C3 * ratio, tracking });
    expect(points[0].frequency).toBeCloseTo(2000 * ratio ** tracking);
    expect(points.at(-1)!.frequency).toBeCloseTo(500 * ratio ** tracking);
  }
});

it.each([0.1, 0.2, 0.5])("combines a %s-second glide with the filter envelope at every point", (glide) => {
  for (const ratio of [0.25, 4]) {
    const points = synthFilterSweep({ ...base, target: C3 * ratio, glideEnd: 1 + glide });
    for (let step = 0; step <= 100; step++) {
      const elapsed = step / 200;
      const envelope = 2000 * (500 / 2000) ** Math.min(1, elapsed / 0.2);
      const pitch = ratio ** Math.min(1, elapsed / glide);
      expect(sample(points, 1 + elapsed)).toBeCloseTo(envelope * pitch, 5);
    }
    expect(points.length).toBeLessThanOrEqual(3);
  }
});

it.each([
  { peak: 12000, resting: 1000, from: C3 * 4, target: C3 * 4, glideEnd: 1 },
  { peak: 8000, resting: 8000, from: C3, target: C3 * 4, glideEnd: 1.5 },
  { peak: 2000, resting: 500, from: C3 / 4000, target: C3 / 4000, glideEnd: 1 },
  { peak: 1000, resting: 10, from: C3 / 4000, target: C3 * 1000, glideEnd: 1.5 },
])("clips at boundary crossings without changing sweep slopes ($peak/$resting)", (settings) => {
  const points = synthFilterSweep({ ...base, ...settings });
  expect(points.length).toBeLessThanOrEqual(7);
  expect(points.every((p, i) => p.frequency >= 1 && p.frequency <= base.ceiling && (i === 0 || p.time > points[i - 1].time))).toBe(true);
  for (let step = 0; step <= 100; step++) {
    const elapsed = step / 200;
    const progress = settings.glideEnd > 1 ? Math.min(1, elapsed / (settings.glideEnd - 1)) : 1;
    const pitch = settings.from * (settings.target / settings.from) ** progress / C3;
    const envelope = settings.peak * (settings.resting / settings.peak) ** Math.min(1, elapsed / 0.2);
    expect(sample(points, 1 + elapsed)).toBeCloseTo(Math.min(base.ceiling, Math.max(1, envelope * pitch)), 5);
  }
});
