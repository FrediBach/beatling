import { describe, expect, it } from "vitest";
import { euclideanCycle, euclideanLfoValue, sampleLfo, type LfoFrame } from "./lfo";

const rhythm = { steps: 8, pulses: 3, rot: 0 };

describe("Euclidean waveform cycles", () => {
  it("stretches three complete cycles into the 3, 3, 2 hit intervals of 3-in-8", () => {
    expect([0, 3, 6].map((position) => euclideanCycle(position, rhythm)?.length)).toEqual([3, 3, 2]);
    expect([0, 3, 6, 8].map((position) => euclideanLfoValue("tri", position, rhythm, 0))).toEqual([0, 0, 0, 0]);
    expect([1.5, 4.5, 7].map((position) => euclideanLfoValue("tri", position, rhythm, 0))).toEqual([1, 1, 1]);
    expect(euclideanLfoValue("ramp", 1.5, rhythm, 0)).toBe(0.5);
  });

  it("rotates cycles in either direction, including intervals crossing step zero", () => {
    expect(euclideanCycle(0, { ...rhythm, rot: 1 })).toEqual({ start: -1, length: 3, phase: 1 / 3 });
    expect(euclideanCycle(0, { ...rhythm, rot: -1 })).toEqual({ start: -1, length: 2, phase: 0.5 });
    expect(euclideanCycle(0, { ...rhythm, rot: 9 })).toEqual(euclideanCycle(0, { ...rhythm, rot: 1 }));
  });

  it("handles no fill, one hit, full fill, one step, and random hold", () => {
    expect(euclideanCycle(3, { ...rhythm, pulses: 0 })).toBeNull();
    expect(euclideanLfoValue("sqr", 3, { ...rhythm, pulses: 0 }, 1)).toBe(0.5);
    expect(euclideanCycle(4, { ...rhythm, pulses: 1 })?.length).toBe(8);
    expect(euclideanLfoValue("tri", 4, { ...rhythm, pulses: 1 }, 0)).toBe(1);
    expect(euclideanLfoValue("tri", 2.5, { ...rhythm, pulses: 8 }, 0)).toBe(1);
    expect(euclideanLfoValue("ramp", 0.5, { steps: 1, pulses: 1, rot: 0 }, 0)).toBe(0.5);
    expect(euclideanLfoValue("rnd", 2.99, rhythm, 0.37)).toBe(0.37);
  });

  it("samples continuous motion from audio time, slows with division, and holds if clocks stop", () => {
    const frame: LfoFrame = { time: 10, position: 0, stepDuration: 0.25, rhythm, shape: "tri", random: 0, euclidean: true };
    expect(sampleLfo(frame, 10).value).toBe(0);
    expect(sampleLfo(frame, 10.125)).toEqual({ position: 0.5, value: 1 / 3 });
    expect(sampleLfo({ ...frame, stepDuration: 0.5 }, 10.125).value).toBe(1 / 6);
    expect(sampleLfo(frame, 50)).toEqual(sampleLfo(frame, 10.25));
    expect(sampleLfo({ ...frame, euclidean: false }, 10.125).value).toBe(0);
  });
});
