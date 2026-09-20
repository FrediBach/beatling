import { describe, expect, it } from "vitest";
import { divisionPhase, ringOffset } from "./orbit";

describe("shared circular clock", () => {
  it("advances at the same division boundary as the sequencer", () => {
    expect(divisionPhase(-1, 1)).toBe(0);
    expect(divisionPhase(0, 1)).toBe(0);
    expect(divisionPhase(1, 1)).toBe(1 / 16);
    expect(divisionPhase(1, 2)).toBe(0);
    expect(divisionPhase(2, 2)).toBe(0);
    expect(divisionPhase(3, 2)).toBe(1 / 16);
    expect(divisionPhase(16, 1)).toBe(0);
    expect(divisionPhase(33, 2)).toBe(0);
  });

  it("aligns independently clocked and unequal length rhythms with the same hand", () => {
    const phase = divisionPhase(23, 1);
    for (const [position, steps] of [[7, 16], [11, 12], [2, 5], [0, 4]]) {
      expect(position / steps + ringOffset(phase, position, steps)).toBeCloseTo(phase);
    }
    expect(ringOffset(phase, -1, 16)).toBe(0);
  });
});
