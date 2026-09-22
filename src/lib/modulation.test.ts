import { afterEach, describe, expect, it, vi } from "vitest";
import { effectiveBlock } from "./euclid";
import { effectiveVoiceModulation } from "./modulation";
import { createEmptyPatch, loadStoredPatch, normalizePatch, savePatch } from "./patch";
import { changedBlockFields, changedVoiceFields, createArrangement, loadStoredArrangement, normalizeArrangement, saveArrangement } from "./variations";
import { connectionsFor } from "./routing";
import { buildLua } from "@/export/lua";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("multiple modulation targets", () => {
  it("applies independent sources and depths simultaneously, clamping at each target", () => {
    const block = createEmptyPatch().blocks[0];
    block.pulses = 4;
    block.prob = 50;
    block.modulations = [
      { source: "1", destination: "pulses", amount: 1 },
      { source: "2", destination: "prob", amount: 0.25 },
      { source: "1", destination: "rot", amount: -0.5 },
      { source: "2", destination: "div", amount: 1 },
      { source: "1", destination: "tune", amount: 0.5 },
      { source: "2", destination: "decay", amount: 0.5 },
      { source: "1", destination: "level", amount: 0 },
    ];
    expect(effectiveBlock(block, (source) => source === 1 ? 1 : 0)).toEqual({ steps: 16, pulses: 12, rot: -8, div: 1, prob: 25, tune: 0.5, decay: -0.5, level: 0 });
    block.modulations[0].source = "";
    block.modulations[1].amount = 1;
    expect(effectiveBlock(block, () => 0)).toMatchObject({ pulses: 4, prob: 0 });
  });

  it("migrates legacy patch and arrangement routing and preserves v12 round trips", () => {
    const legacy = { ...createEmptyPatch(), format: "euclid-grid.v2", blocks: [{ pulses: 4, modSrc: "12", modDst: "prob", modAmt: -0.65 }] };
    localStorage.setItem("egs.patch.v2", JSON.stringify(legacy));
    const patch = loadStoredPatch()!;
    expect(patch.format).toBe("euclid-grid.v13");
    expect(patch.blocks[0].modulations).toEqual([{ source: "12", destination: "prob", amount: -0.65 }]);
    expect(patch.blocks[0]).not.toHaveProperty("modSrc");
    patch.blocks[0].modulations.push({ source: "13", destination: "rot", amount: 0.4 });
    savePatch(patch);
    expect(loadStoredPatch()).toEqual(patch);
    const arrangement = { ...createArrangement(patch), format: "euclid-grid.arrangement.v2", variations: [{ id: "a", name: "A", patch: legacy }] };
    localStorage.setItem("egs.arrangement.v2", JSON.stringify(arrangement));
    const loaded = loadStoredArrangement(patch);
    expect(loaded.variations[0].patch.blocks[0].modulations).toEqual([{ source: "12", destination: "prob", amount: -0.65 }]);
    saveArrangement(createArrangement(patch));
    expect(loadStoredArrangement(patch).variations[0].patch).toEqual(patch);
    expect(normalizeArrangement(arrangement, patch).format).toBe("euclid-grid.arrangement.v13");
  });

  it("loads v7 storage with silent default Karplus–Strong sends", () => {
    const legacyPatch = structuredClone(createEmptyPatch()) as unknown as {
      format: string;
      effects: { karplus?: unknown; sends: Record<string, Record<string, unknown>> };
    };
    legacyPatch.format = "euclid-grid.v7";
    delete legacyPatch.effects.karplus;
    Object.values(legacyPatch.effects.sends).forEach((sends) => { delete sends.karplus; });
    localStorage.setItem("egs.patch.v7", JSON.stringify(legacyPatch));

    const patch = loadStoredPatch()!;
    expect(patch.format).toBe("euclid-grid.v13");
    expect(patch.effects.karplus).toMatchObject({ enabled: false, model: "string" });
    expect(patch.effects.sends.rim.karplus).toBe(0);

    localStorage.setItem("egs.arrangement.v7", JSON.stringify({
      ...createArrangement(patch),
      format: "euclid-grid.arrangement.v7",
      variations: [{ id: "legacy", name: "A", patch: legacyPatch }],
    }));
    const arrangement = loadStoredArrangement(patch);
    expect(arrangement.format).toBe("euclid-grid.arrangement.v13");
    expect(arrangement.variations[0].patch.effects.sends.rim.karplus).toBe(0);
  });

  it("normalizes invalid routes, duplicate targets, depths and step bounds", () => {
    const patch = normalizePatch({ blocks: [{ steps: 8, pulses: 50, modulations: [
      null, { source: "99", destination: "prob", amount: 1 },
      { source: "0", destination: "prob", amount: 1 },
      { source: "1", destination: "prob", amount: -4 },
      { source: "2", destination: "prob", amount: 0.5 },
      { source: "1.5", destination: "rot", amount: 1 },
      { source: "1", destination: "steps", amount: 1 },
      { source: "", destination: "rot", amount: Infinity },
    ] }] })!;
    expect(patch.blocks[0].pulses).toBe(8);
    expect(patch.blocks[0].modulations).toEqual([{ source: "1", destination: "prob", amount: -1 }, { source: "", destination: "rot", amount: 0 }]);
    expect(changedBlockFields(patch.blocks[0], structuredClone(patch.blocks[0]))).toEqual(new Set());
    const changed = structuredClone(patch.blocks[0]);
    changed.modulations[0].amount = 0.5;
    expect(changedBlockFields(changed, patch.blocks[0])).toEqual(new Set(["modulations"]));
  });

  it("normalizes and resolves shared voice modulation independently of block hits", () => {
    const patch = normalizePatch({ ...createEmptyPatch(), voices: {
      ...createEmptyPatch().voices,
      kick: { ...createEmptyPatch().voices.kick, modulations: [
        { source: "12", destination: "tune", amount: 0.5 },
        { source: "13", destination: "decay", amount: -2 },
        { source: "14", destination: "level", amount: 0.25 },
        { source: "15", destination: "level", amount: 1 },
        { source: "99", destination: "tune", amount: 1 },
      ] },
    } })!;
    expect(patch.voices.kick.modulations).toEqual([
      { source: "12", destination: "tune", amount: 0.5 },
      { source: "13", destination: "decay", amount: -1 },
      { source: "14", destination: "level", amount: 0.25 },
    ]);
    expect(effectiveVoiceModulation(patch.voices.kick, (source) => source === 12 ? 1 : source === 13 ? 0 : 0.75)).toEqual({ tune: 0.5, decay: 1, level: 0.125, vOct: 0 });
    const base = createEmptyPatch().voices.kick;
    expect(changedVoiceFields(patch.voices.kick, base)).toContain("modulations");
  });

  it("traces and exports every rhythm target without dropping routes", () => {
    const patch = createEmptyPatch();
    patch.blocks[0].modulations = [{ source: "12", destination: "prob", amount: -0.65 }, { source: "12", destination: "rot", amount: 0.5 }, { source: "13", destination: "tune", amount: 0.3 }];
    expect(connectionsFor(patch.blocks)).toEqual([
      { source: 12, target: 0, output: "LFO", input: "chance" },
      { source: 12, target: 0, output: "LFO", input: "rotate" },
      { source: 13, target: 0, output: "LFO", input: "voice tune" },
    ]);
    const lua = buildLua(patch);
    expect(lua).toContain("mods={{ src=13, dst=3, amt=-0.65 }, { src=13, dst=2, amt=0.50 }}");
    expect(lua).toContain("browser voice mod (tune) not exported");
  });

  it("traces voice destinations and marks browser-only voice routes in Lua", () => {
    const patch = createEmptyPatch();
    patch.voices.kick.modulations = [{ source: "12", destination: "tune", amount: 0.5 }];
    expect(connectionsFor(patch)).toContainEqual({ source: 12, target: "kick", output: "LFO", input: "Tune" });
    expect(buildLua(patch)).toContain("browser voice routing: kick tune <- block 13 (50%) not exported");
  });
});
