import { describe, expect, it } from "vitest";
import { createDemoPatch, createEmptyPatch, createRandomizationLocks, normalizePatch } from "@/lib/patch";
import { VOICE_DEFS } from "@/lib/constants";
import { SCALE_DEFS } from "@/lib/quantizer";
import { generateMusicalPatch } from "./generate";
import { musicalEvents } from "./evaluate";
import { defaultRequest, type GrooveProfile, type MusicalRequest } from "./types";

function generate(source = createEmptyPatch(), settings: Partial<MusicalRequest> = {}, seed = 42) {
  const result = generateMusicalPatch(source, { ...defaultRequest(source), ...settings }, seed);
  expect(result.error).toBeUndefined();
  return result.candidate!.patch;
}

function freeze(value: unknown) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
}

describe("musical generation", () => {
  it("does not reshape a pitch LFO also used by a Quantizer", () => {
    const source = createEmptyPatch();
    Object.assign(source.blocks[0], { kind: "voice", voice: "bassline", pulses: 4 });
    Object.assign(source.blocks[12], { steps: 7, pulses: 2, shape: "tri" });
    Object.assign(source.blocks[13], { kind: "quantizer", quantizerSource: "12", steps: 12, pulses: 7 });
    source.voices.bassline.modulations = [{ source: "12", destination: "vOct", amount: 1 }];
    const patch = generate(source, { mode: "reshape", parts: ["bassline"], reshapeMelody: true });
    expect(patch.blocks[12]).toEqual(source.blocks[12]);
    expect(patch.blocks[13]).toEqual(source.blocks[13]);
    expect(patch.voices.bassline.modulations).toEqual(source.voices.bassline.modulations);
  });
  it("keeps an external quantizer and its CV source when preserving a synth", () => {
    const source = createDemoPatch();
    Object.assign(source.blocks[12], { kind: "quantizer", voice: "", quantizerSource: "14", steps: 12, pulses: 7 });
    source.voices.bassline.custom.quantizer = 0;
    const patch = generate(source, { keep: ["bassline"] });
    for (const slot of [7, 12, 14]) expect(patch.blocks[slot]).toEqual(source.blocks[slot]);
    expect(patch.voices.bassline).toEqual(source.voices.bassline);
  });
  it("is deterministic, immutable, normalized, and produces different ideas", () => {
    const source = createDemoPatch();
    const request = defaultRequest(source);
    freeze(source); freeze(request);
    const a = generateMusicalPatch(source, request, 12);
    expect(a).toEqual(generateMusicalPatch(source, request, 12));
    expect(a.candidate!.patch).toEqual(normalizePatch(a.candidate!.patch));
    expect(a.candidate!.patch.blocks).toHaveLength(16);
    expect(a.candidate!.patch.vol).toBe(source.vol);
    expect(generateMusicalPatch(source, request, 13, undefined, a.candidate!.patch).candidate!.patch).not.toEqual(a.candidate!.patch);
  });

  it.each<GrooveProfile>(["steady", "broken", "halftime", "rolling"])("coordinates %s drums and tonal parts across densities and seeds", (profile) => {
    const totals = [0, 0, 0];
    for (const density of [0, 1, 2] as const) for (const seed of [7, 19, 31]) {
      const patch = generate(undefined, { profile, density, root: 2, scale: 2 }, seed);
      const events = musicalEvents(patch);
      expect(new Set(events.map((event) => `${event.voice}:${event.pulse}`)).size).toBe(events.length);
      const voices = new Set(events.map((event) => event.voice));
      for (const voice of ["kick", "snare", "bassline", "lead"] as const) expect(voices.has(voice)).toBe(true);
      for (const event of events) {
        if (event.midi === undefined) continue;
        expect(SCALE_DEFS[2].intervals as readonly number[]).toContain(((event.midi - 2) % 12 + 12) % 12);
        expect(event.midi).toBeGreaterThanOrEqual(event.voice === "bassline" ? 38 : 62);
        expect(event.midi).toBeLessThanOrEqual(event.voice === "bassline" ? 50 : 74);
      }
      const backbeat = events.filter((event) => event.voice === "snare").map((event) => event.pulse % 16);
      expect(new Set(backbeat)).toEqual(new Set(profile === "halftime" || profile === "rolling" ? [8] : [4, 12]));
      if (profile === "steady" || profile === "rolling") expect(events.filter((event) => event.voice === "kick").every((event) => event.pulse % 4 === 0)).toBe(true);
      totals[density] += events.filter((event) => !["kick", "snare"].includes(event.voice)).length;
    }
    expect(totals[0]).toBeLessThan(totals[1]);
    expect(totals[1]).toBeLessThan(totals[2]);
  }, 15000);

  it.each([0, 1, 2] as const)("returns to its complete rhythmic and melodic phrase for development %i", (development) => {
    const patch = generate(undefined, { development });
    const length = [16, 32, 64][development];
    const events = musicalEvents(patch, 8);
    const first = events.filter((event) => event.pulse < length);
    const second = events.filter((event) => event.pulse >= length && event.pulse < 2 * length).map((event) => ({ ...event, pulse: event.pulse - length }));
    expect(second).toEqual(first);
  });

  it("includes selected instruments only and fits all fourteen voices", () => {
    const bass = generate(undefined, { parts: ["bassline"] });
    expect(new Set(musicalEvents(bass).map((event) => event.voice))).toEqual(new Set(["bassline"]));
    const all = generate(undefined, { parts: VOICE_DEFS.map(({ id }) => id) });
    expect(all.blocks).toHaveLength(16);
    expect(new Set(musicalEvents(all).map((event) => event.voice)).size).toBe(14);
  });

  it("preserves kept parts, their recursive dependencies, processing, and timing", () => {
    const source = createDemoPatch();
    source.blocks[12].clk = ["14"];
    source.blocks[14].rst = "12"; // Cycle in the graph must remain bounded.
    const result = generateMusicalPatch(source, { ...defaultRequest(source), keep: ["bassline"] }, 3);
    expect(result.error).toBeUndefined();
    const patch = result.candidate!.patch;
    for (const slot of [7, 12, 14]) expect(patch.blocks[slot]).toEqual(source.blocks[slot]);
    expect(patch.voices.bassline).toEqual(source.voices.bassline);
    expect(patch.effects).toEqual(source.effects);
    expect(patch).toMatchObject({ bpm: source.bpm, rate: source.rate, swing: source.swing });
  });

  it("honors individual locks in reshape and preserves the original series and sounds", () => {
    const source = generate(undefined, { development: 2 });
    const slots = source.blocks.flatMap((block, index) => block.voice === "ch" ? [index] : []);
    const slot = slots[0];
    source.blocks[slot].rot = -3;
    const locks = createRandomizationLocks();
    locks[slot].rot = true;
    locks[slot].pulses = true;
    const result = generateMusicalPatch(source, { ...defaultRequest(source, "reshape"), density: 2, change: 2 }, 5, locks);
    expect(result.error).toBeUndefined();
    const patch = result.candidate!.patch;
    expect(patch.blocks[slot].rot).toBe(-3);
    expect(patch.blocks[slot].pulses).toBe(source.blocks[slot].pulses);
    expect(patch.blocks[slot].series).toEqual(source.blocks[slot].series);
    expect(patch.voices).toEqual(source.voices);
    expect(patch.effects).toEqual(source.effects);
    expect(patch.blocks.map((block) => [block.voice, block.clk, block.rst, block.mut, block.modulations])).toEqual(source.blocks.map((block) => [block.voice, block.clk, block.rst, block.mut, block.modulations]));
  });

  it("keeps excluded parts and a voiced modulation source unchanged in reshape", () => {
    const source = createDemoPatch();
    source.blocks[5].modulations = [{ source: "0", destination: "level", amount: 0.2 }];
    const result = generateMusicalPatch(source, { ...defaultRequest(source, "reshape"), parts: ["kick", "snare", "bassline"], change: 2, density: 2 }, 18);
    expect(result.error).toBeUndefined();
    const patch = result.candidate!.patch;
    expect(patch.blocks[0]).toEqual(source.blocks[0]);
    expect(patch.blocks[5]).toEqual(source.blocks[5]);
    expect(patch.voices.rim).toEqual(source.voices.rim);
  });

  it("does not reshape a locked or shared melodic source", () => {
    const source = generate();
    const bassSource = Number(source.voices.bassline.modulations[0].source);
    source.voices.lead.modulations[0].source = `${bassSource}`;
    const request = { ...defaultRequest(source, "reshape"), reshapeMelody: true, change: 2 as const, density: 2 as const };
    const result = generateMusicalPatch(source, request, 90);
    expect(result.error).toBeUndefined();
    expect(result.candidate!.patch.blocks[bassSource]).toEqual(source.blocks[bassSource]);
    expect(result.candidate!.notices.join(" ")).toMatch(/pitch routing was kept/);
  });

  it("preserves existing separate tuning when requested for new synth parts", () => {
    const source = createDemoPatch();
    source.voices.lead.custom.root = 7;
    source.voices.lead.tune = 3;
    const patch = generate(source, { harmony: "keep" });
    expect(patch.voices.lead.custom).toMatchObject({ root: 7, scale: source.voices.lead.custom.scale, octave: source.voices.lead.custom.octave });
    expect(patch.voices.lead.tune).toBe(3);
  });

  it("reports empty selections, all locks, unavailable slots and unsupported clock constraints", () => {
    const source = createDemoPatch();
    expect(generateMusicalPatch(source, { ...defaultRequest(source), parts: [] }, 1).error).toMatch(/Choose/);
    expect(generateMusicalPatch(source, defaultRequest(source), 1, createRandomizationLocks(true)).error).toMatch(/protected/);
    const full = createEmptyPatch();
    full.blocks.forEach((block) => { block.kind = "voice"; block.voice = "kick"; block.pulses = 4; });
    expect(generateMusicalPatch(full, { ...defaultRequest(full), keep: ["kick"] }, 1).error).toMatch(/slots/);
    source.rate = 8;
    expect(generateMusicalPatch(source, { ...defaultRequest(source), keep: ["kick"] }, 1).error).toMatch(/clock rate/);
  });
});
