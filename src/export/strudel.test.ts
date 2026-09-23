import { describe, expect, it } from "vitest";
import { buildStrudel } from "@/export/strudel";
import { createDemoPatch, createEmptyPatch } from "@/lib/patch";

describe("Strudel export", () => {
  it("exports playable Euclidean patterns with patch timing and sound banks", () => {
    const code = buildStrudel(createDemoPatch());
    expect(code).toContain("setcpm(31)");
    expect(code).toContain('s("bd").bank("RolandTR909").euclidRot(4, 16, 0)');
    expect(code).toContain(".degradeBy(0.08)");
    expect(code).toContain(".swingBy(0.12, 8)");
    expect(code).toContain('note("36").s("sawtooth")');
    expect(code).toContain("Routing, resets, mute inputs, modulation, and Euclidean Quantizer CV are not portable");
  });

  it("uses arrange to preserve rhythm series and emits silence for an empty patch", () => {
    const patch = createEmptyPatch();
    patch.blocks[0].pulses = 4;
    patch.blocks[0].repeats = 2;
    patch.blocks[0].series = [{ id: "second", steps: 8, pulses: 3, rot: 1, repeats: 3 }];
    const code = buildStrudel(patch);
    expect(code).toContain("arrange(");
    expect(code).toContain('[2, s("bd").bank("RolandTR909").euclidRot(4, 16, 0)]');
    expect(code).toContain('[1.5, s("bd").bank("RolandTR909").euclidRot(3, 8, 1).slow(0.5)]');

    patch.blocks[0].pulses = 0;
    patch.blocks[0].series = [];
    expect(buildStrudel(patch)).toContain("silence");
  });

  it("exports only audible soloed voices and still respects their mutes", () => {
    const patch = createDemoPatch();
    patch.voices.kick.solo = true;
    let code = buildStrudel(patch);
    expect(code).toContain('s("bd")');
    expect(code).not.toContain('s("sd")');

    patch.voices.kick.mute = true;
    code = buildStrudel(patch);
    expect(code).not.toContain('s("bd")');
    expect(code).not.toContain('s("sd")');
  });
});
