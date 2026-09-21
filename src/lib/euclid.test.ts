import { describe, expect, it } from "vitest";
import { effectiveBlock, euclidHit, lfoValue, volumeGain } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";

describe("Euclidean rhythm", () => {
  it("distributes pulses over a cycle", () => {
    const pattern = Array.from({ length: 8 }, (_, index) => euclidHit(index, 8, 3, 0));
    expect(pattern).toEqual([true, false, false, true, false, false, true, false]);
  });

  it("rotates in both directions", () => {
    expect(euclidHit(0, 8, 3, -1)).toBe(false);
    expect(euclidHit(1, 8, 3, -1)).toBe(true);
    expect(euclidHit(0, 8, 3, 1)).toBe(false);
  });

  it("handles empty and full patterns", () => {
    expect(euclidHit(0, 16, 0, 0)).toBe(false);
    expect(euclidHit(9, 16, 16, 0)).toBe(true);
  });
});

describe("modulation", () => {
  it("modulates and clamps a destination", () => {
    const block = { ...createBlock(0), pulses: 4, modulations: [{ source: "1" as const, destination: "pulses" as const, amount: 1 }] };
    expect(effectiveBlock(block, () => 1).pulses).toBe(12);
    expect(effectiveBlock({ ...block, steps: 6 }, () => 1).pulses).toBe(6);
  });

  it("reproduces all LFO shapes", () => {
    expect(lfoValue("ramp", 0.25, 0.9)).toBe(0.25);
    expect(lfoValue("tri", 0.75, 0.9)).toBe(0.5);
    expect(lfoValue("sqr", 0.75, 0.9)).toBe(0);
    expect(lfoValue("rnd", 0.25, 0.9)).toBe(0.9);
  });

  it("maps master volume like the POC", () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(100)).toBeCloseTo(1.1);
  });
});
