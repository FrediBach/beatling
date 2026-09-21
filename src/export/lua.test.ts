import { describe, expect, it } from "vitest";
import { buildLua } from "@/export/lua";
import { createDemoPatch, createEmptyPatch } from "@/lib/patch";

describe("Disting NT Lua export", () => {
  it("exports routing, outputs and clock metadata as data only", () => {
    const lua = buildLua(createDemoPatch());
    expect(lua).toContain("return {");
    expect(lua).toContain("bpm = 124");
    expect(lua).toContain("rate = 4");
    expect(lua).toContain("bar = 16");
    expect(lua).toContain("clk={0, 2}");
    expect(lua).toContain('{ type="linear", name="13 LFO" }');
    expect(lua).toContain("euclidean=true");
    expect(lua).toContain("euclidean=false");
    expect(lua).toContain("series={{ steps=16, pulses=4, rot=0, repeats=1 }}");
    expect(lua).not.toContain("local function");
    expect(lua).not.toContain("trigger = function");
  });

  it("always creates at least one output", () => {
    const patch = createEmptyPatch();
    patch.blocks.forEach((block) => { block.voice = ""; });
    const lua = buildLua(patch);
    expect(lua).toContain('{ type="stepped", name="01 trig" }');
  });
});
