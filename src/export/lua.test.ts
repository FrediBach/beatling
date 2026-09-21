import { describe, expect, it } from "vitest";
import { buildLua } from "@/export/lua";
import { createDemoPatch, createEmptyPatch } from "@/lib/patch";

describe("Disting NT Lua export", () => {
  it("exports routing, outputs and clock metadata", () => {
    const lua = buildLua(createDemoPatch(), new Date("2026-09-20T12:00:00Z"));
    expect(lua).toContain("Exported 2026-09-20 at 124 BPM, 1/16 clock.");
    expect(lua).toContain("clk={0, 2}");
    expect(lua).toContain('name = \'Euclid Grid\'');
    expect(lua).toContain("kLinear");
    expect(lua).toContain("euclidean=true");
    expect(lua).toContain("euclidean=false");
    expect(lua).toContain("series={{ steps=16, pulses=4, rot=0, repeats=1 }}");
    expect(lua).toContain("local phase = cyclePhase(pos[i] + fraction, r)");
    expect(lua).toContain("now = now + dt");
  });

  it("always creates at least one output", () => {
    const patch = createEmptyPatch();
    patch.blocks.forEach((block) => { block.voice = ""; });
    const lua = buildLua(patch);
    expect(lua).toContain("outputs = { kStepped }");
    expect(lua).toContain('outputNames = { "01 trig" }');
  });
});
