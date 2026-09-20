import { describe, expect, it } from "vitest";
import { createEmptyPatch } from "@/lib/patch";
import { changedBlockFields, createArrangement, normalizeArrangement, variationHasChanges } from "@/lib/variations";

describe("variation arrangements", () => {
  it("migrates legacy repeat counts into song parts and clamps invalid indexes", () => {
    const patch = createEmptyPatch();
    const arrangement = normalizeArrangement({
      variations: [{ id: "one", repeats: 99, patch }],
      activeIndex: 50,
      songMode: true,
    }, patch);
    expect(arrangement.variations[0]).toMatchObject({ name: "A" });
    expect(arrangement.songParts[0]).toMatchObject({ variationId: "one", bars: 16 });
    expect(arrangement.activeIndex).toBe(0);
    expect(arrangement.activeSongPartIndex).toBe(0);
    expect(arrangement.songMode).toBe(true);
  });

  it("finds field-level changes relative to variation A", () => {
    const patch = createEmptyPatch();
    const arrangement = createArrangement(patch);
    const changedPatch = { ...patch, blocks: patch.blocks.map((block, index) => index === 0 ? { ...block, pulses: 4 } : block) };
    const variation = { id: "variation-2", name: "B", patch: changedPatch };
    expect(changedBlockFields(changedPatch.blocks[0], patch.blocks[0])).toEqual(new Set(["pulses"]));
    expect(variationHasChanges(variation, arrangement.variations[0])).toBe(true);
  });

  it("treats effect and send edits as variation changes", () => {
    const patch = createEmptyPatch();
    const changedPatch = {
      ...patch,
      effects: {
        ...patch.effects,
        sends: { ...patch.effects.sends, kick: { ...patch.effects.sends.kick, reverb: 35 } },
      },
    };
    expect(variationHasChanges({ id: "variation-2", name: "B", patch: changedPatch }, { id: "variation-1", name: "A", patch })).toBe(true);
  });
});
