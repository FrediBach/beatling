import { describe, expect, it } from "vitest";
import { createDemoPatch, createEmptyPatch, normalizePatch, shufflePatch } from "@/lib/patch";

describe("patches", () => {
  it("creates the complete 16-block demo", () => {
    const patch = createDemoPatch();
    expect(patch.blocks).toHaveLength(16);
    expect(patch.blocks[0]).toMatchObject({ voice: "kick", steps: 16, pulses: 4 });
    expect(patch.blocks[2]).toMatchObject({ modSrc: "12", modDst: "prob", modAmt: -0.5 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("808");
  });

  it("keeps routing when patterns are shuffled", () => {
    const patch = createDemoPatch();
    const shuffled = shufflePatch(patch, () => 0.5);
    expect(shuffled.blocks[9].clk).toEqual(["G", "1"]);
    expect(shuffled.blocks[0]).toMatchObject({ steps: 16, pulses: 4, rot: 0 });
  });

  it("normalizes partial imported patches without sharing defaults", () => {
    const normalized = normalizePatch({ blocks: [{ pulses: 7, clk: ["0"] }], bpm: 999 });
    expect(normalized?.bpm).toBe(300);
    expect(normalized?.blocks).toHaveLength(16);
    expect(normalized?.blocks[0].pulses).toBe(7);
    expect(normalized?.blocks[1]).toEqual(createEmptyPatch().blocks[1]);
  });
});
