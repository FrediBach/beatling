import { describe, expect, it } from "vitest";
import { buildLua } from "@/export/lua";
import { createDemoPatch, createEmptyPatch } from "@/lib/patch";
import { BLOCK_COUNT, type LfoShape } from "@/lib/types";

const blockRows = (lua: string) => lua.split("\n").filter((line) => line.startsWith("\t\t{ steps="));

describe("Disting NT Lua export", () => {
  it("exports routing, outputs and clock metadata as data only", () => {
    const lua = buildLua(createDemoPatch());
    expect(lua).toContain("return {");
    expect(lua).toContain("bpm = 124");
    expect(lua).toContain("rate = 4");
    expect(lua).toContain("bar = 16");
    expect(lua).toContain("version = 1");
    expect(lua).toContain("swing = 12");
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
    expect(blockRows(lua)).toHaveLength(BLOCK_COUNT);
    expect(blockRows(lua)[0]).toContain('out=1, lout=0, tag="--"');
  });

  it.each([2, 4, 6, 8])("exports timing at rate %i without changing existing field meanings", (rate) => {
    const patch = createEmptyPatch();
    patch.rate = rate;
    patch.swing = 37.5;
    const lua = buildLua(patch);
    expect(lua).toContain(`rate = ${rate}`);
    expect(lua).toContain(`bar = ${rate * 4}`);
    expect(lua).toContain("swing = 37.5");
  });

  it("keeps all fixed block identities and encodes source sentinels separately from output indices", () => {
    const patch = createEmptyPatch();
    Object.assign(patch.blocks[0], { clk: ["G", "15"], rst: "BAR", mut: "14", mute: true });
    patch.blocks[1].rst = "G";
    patch.blocks[2].rst = "15";
    const rows = blockRows(buildLua(patch));
    expect(rows).toHaveLength(16);
    expect(rows[0]).toContain("clk={0, 16}, rst=-1, mut=15, mn=true");
    expect(rows[1]).toContain("rst=0, mut=0, mn=false");
    expect(rows[2]).toContain("rst=16");
    expect(rows[3]).toContain("rst=-9");
    expect(rows[12]).toContain("out=0, lout=0");
    expect(rows[14]).toContain("out=13, lout=0");
    expect(rows[15]).toContain("out=14, lout=0");
  });

  it("exports the complete ordered rhythm series including first-rhythm repeats", () => {
    const patch = createEmptyPatch();
    Object.assign(patch.blocks[0], { steps: 8, pulses: 3, rot: -1, repeats: 2, series: [
      { id: "second", steps: 5, pulses: 2, rot: 1, repeats: 3 },
    ] });
    expect(blockRows(buildLua(patch))[0]).toContain("steps=8, pulses=3, rot=-1, series={{ steps=8, pulses=3, rot=-1, repeats=2 }, { steps=5, pulses=2, rot=1, repeats=3 }}");
  });

  it("preserves every rhythm destination and modulation precision", () => {
    const patch = createEmptyPatch();
    patch.blocks[0].modulations = [
      { source: "12", destination: "pulses", amount: 0.004 },
      { source: "13", destination: "rot", amount: -0.123456 },
      { source: "14", destination: "prob", amount: 1 },
      { source: "15", destination: "div", amount: 0 },
    ];
    const lua = buildLua(patch);
    expect(blockRows(lua)[0]).toContain("mods={{ src=13, dst=1, amt=0.004 }, { src=14, dst=2, amt=-0.123456 }, { src=15, dst=3, amt=1 }, { src=16, dst=4, amt=0 }}");
    expect(lua).toContain('name="13 LFO"');
    expect(lua).not.toContain('name="16 LFO"');
  });

  it("does not allocate linear outputs for omitted browser voice modulation", () => {
    const patch = createEmptyPatch();
    patch.blocks[0].modulations = [{ source: "12", destination: "tune", amount: 1 }];
    patch.voices.bassline.modulations = [{ source: "13", destination: "vOct", amount: 1 }];
    const lua = buildLua(patch);
    expect(lua).not.toContain('type="linear"');
    expect(lua).toContain("browser voice mod (tune) not exported");
    expect(lua).toContain("browser voice routing: bassline vOct <- block 14 (100%) not exported");
  });

  it.each([0, 35, 100])("preserves Bernoulli triggers at branch chance %i", (prob) => {
    const patch = createEmptyPatch();
    Object.assign(patch.blocks[0], { kind: "bernoulli", voice: "", pulses: 4, prob, modulations: [
      { source: "12", destination: "prob", amount: -1 },
      { source: "13", destination: "pulses", amount: 0.25 },
    ] });
    patch.blocks[1].clk = ["0"];
    const lua = buildLua(patch);
    const row = blockRows(lua)[0];
    expect(row).toContain("prob=100");
    expect(row).toContain('euclidean=true, mods={{ src=14, dst=1, amt=0.25 }}, out=1, lout=0, tag="--"');
    expect(row).toContain("Bernoulli voices kick/snare (branch chance and its modulation)");
    expect(lua).not.toContain('name="13 LFO"');
  });

  it("encodes waveform numbers and the two LFO timing modes", () => {
    const patch = createEmptyPatch();
    const shapes: LfoShape[] = ["ramp", "tri", "sqr", "rnd"];
    shapes.forEach((shape, index) => { patch.blocks[index].shape = shape; });
    const rows = blockRows(buildLua(patch));
    shapes.forEach((_shape, index) => expect(rows[index]).toContain(`shape=${index + 1}, euclidean=false`));
    expect(rows[12]).toContain("euclidean=true");
  });

  it("caps outputs at 28 without losing internal routes or mutating the patch", () => {
    const patch = createEmptyPatch();
    patch.blocks.forEach((block, index) => {
      block.kind = "voice";
      block.voice = "kick";
      block.modulations = [{ source: String((index + 1) % BLOCK_COUNT) as `${number}`, destination: "pulses", amount: 1 }];
    });
    const before = structuredClone(patch);
    const lua = buildLua(patch);
    expect(lua.match(/type="(?:linear|stepped)"/g)).toHaveLength(28);
    expect(blockRows(lua)[11]).toContain("out=12, lout=28");
    expect(blockRows(lua)[12]).toContain("out=13, lout=0");
    expect(blockRows(lua)[14]).toContain("mods={{ src=16, dst=1, amt=1 }}");
    expect(lua).toContain("no linear output for blocks 13, 14, 15, 16; internal modulation still applies");
    expect(buildLua(patch)).toBe(lua);
    expect(patch).toEqual(before);
  });
});
