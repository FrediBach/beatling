import { describe, expect, it } from "vitest";
import { createDemoPatch, createEmptyPatch, createRandomizationLocks, normalizePatch, randomizeBlockParameter, shufflePatch } from "@/lib/patch";
import { createPresetPatch, DRUM_PRESETS } from "@/lib/presets";
import { euclidHit } from "@/lib/euclid";

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

  it("keeps locked settings unchanged while shuffling the rest", () => {
    const patch = createDemoPatch();
    const locks = createRandomizationLocks();
    locks[1].steps = true;
    locks[1].prob = true;
    const shuffled = shufflePatch(patch, () => 0, locks);
    expect(shuffled.blocks[1]).toMatchObject({ steps: 16, prob: 100, pulses: 0, rot: 0, div: 1 });
    expect(shuffled.blocks[1].clk).toEqual(patch.blocks[1].clk);
  });

  it("randomizes one setting without changing its neighbours", () => {
    const block = createDemoPatch().blocks[2];
    const randomized = randomizeBlockParameter(block, 2, "prob", () => 0);
    expect(randomized).toMatchObject({ steps: block.steps, pulses: block.pulses, rot: block.rot, div: block.div, prob: 40 });
  });

  it("normalizes partial imported patches without sharing defaults", () => {
    const normalized = normalizePatch({ blocks: [{ pulses: 7, clk: ["0"] }], bpm: 999 });
    expect(normalized?.bpm).toBe(300);
    expect(normalized?.blocks).toHaveLength(16);
    expect(normalized?.blocks[0].pulses).toBe(7);
    expect(normalized?.blocks[1]).toEqual(createEmptyPatch().blocks[1]);
  });

  it("builds every documented drum preset within the 16-block system", () => {
    expect(DRUM_PRESETS).toHaveLength(40);
    for (const preset of DRUM_PRESETS) {
      const patch = createPresetPatch(preset.id);
      expect(patch.blocks).toHaveLength(16);
      expect(patch.bpm).toBe(preset.bpm);
      expect(patch.blocks.some((block) => block.pulses > 0)).toBe(true);
      if (preset.id === "acid-tom-fill") continue;
      for (const lane of preset.lanes) {
        const steps = lane.steps ?? 16;
        const actual = Array.from({ length: steps }, (_, step) => patch.blocks.some((block) => block.voice === lane.voice && block.steps === steps && euclidHit(step, block.steps, block.pulses, block.rot)));
        const expected = Array.from({ length: steps }, (_, step) => lane.hits.includes(step));
        expect(actual, `${preset.id}: ${lane.voice}`).toEqual(expected);
      }
    }
  });

  it("builds the two-bar acid fill with Euclidean mute gates", () => {
    const patch = createPresetPatch("acid-tom-fill");
    expect(patch.blocks[0]).toMatchObject({ voice: "", steps: 32, pulses: 1, gate: 100 });
    expect(patch.blocks[1]).toMatchObject({ voice: "", steps: 32, pulses: 1, gate: 800 });
    expect(patch.blocks[2]).toMatchObject({ voice: "kick", steps: 16, pulses: 4, mut: "0" });
    expect(patch.blocks[4]).toMatchObject({ voice: "ch", steps: 16, pulses: 16, mut: "1" });
    expect(patch.blocks.filter((block) => ["lt", "mt", "ht"].includes(block.voice) && block.steps === 32)).toHaveLength(5);
  });

  it("recreates the electro backbeat with layered Euclidean blocks", () => {
    const patch = createPresetPatch("electro-backbeat");
    const hitsFor = (voice: string) => Array.from({ length: 16 }, (_, step) => patch.blocks.some((block) => block.voice === voice && euclidHit(step, block.steps, block.pulses, block.rot)));
    expect(hitsFor("kick")).toEqual([true, false, false, false, false, false, true, false, true, false, false, false, false, false, true, false]);
    expect(hitsFor("cow")).toEqual([false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false]);
  });
});
