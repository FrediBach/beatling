import { describe, expect, it } from "vitest";
import { createEmptyPatch } from "@/lib/patch";
import { changedBlockFields, createArrangement, normalizeArrangement, variationHasChanges } from "@/lib/variations";

describe("variation arrangements", () => {
  it("normalizes repeat counts and invalid active indexes", () => {
    const patch = createEmptyPatch();
    const arrangement = normalizeArrangement({
      variations: [{ id: "one", repeats: 99, patch }],
      activeIndex: 50,
      songMode: true,
    }, patch);
    expect(arrangement.variations[0]).toMatchObject({ name: "A", repeats: 16 });
    expect(arrangement.activeIndex).toBe(0);
    expect(arrangement.songMode).toBe(true);
  });

  it("finds field-level changes relative to variation A", () => {
    const patch = createEmptyPatch();
    const arrangement = createArrangement(patch);
    const changedPatch = { ...patch, blocks: patch.blocks.map((block, index) => index === 0 ? { ...block, pulses: 4 } : block) };
    const variation = { id: "variation-2", name: "B", repeats: 1, patch: changedPatch };
    expect(changedBlockFields(changedPatch.blocks[0], patch.blocks[0])).toEqual(new Set(["pulses"]));
    expect(variationHasChanges(variation, arrangement.variations[0])).toBe(true);
  });
});
