import { describe, expect, it } from "vitest";
import { euclidHit } from "@/lib/euclid";
import { normalizePatch } from "@/lib/patch";
import { createPresetArrangement, createPresetPatch } from "@/lib/presets";
import { rhythmsFor } from "@/lib/rhythm-series";
import { euclideanLfoValue } from "@/lib/lfo";
import { effectiveVoiceModulation } from "@/lib/modulation";
import { quantizeVoiceCv } from "@/lib/quantizer";
import type { Patch, VoiceId } from "@/lib/types";

// Expand the authored series into global clock positions (rate × 4 per bar). These presets
// use the global clock at division 1, without chance or routed mute inputs.
// Acid with Tom Fill's routed drums are checked through the engine instead.
function hitsFor(patch: Patch, voice: VoiceId, bars: number): number[] {
  const hits = new Set<number>();
  for (const block of patch.blocks) {
    if (block.voice !== voice || block.mute || patch.voices[voice].mute) continue;
    const cycle = rhythmsFor(block).flatMap((rhythm) => Array.from({ length: rhythm.repeats * rhythm.steps }, (_, step) =>
      euclidHit(step % rhythm.steps, rhythm.steps, rhythm.pulses, rhythm.rot)));
    for (let step = 0; step < bars * patch.rate * 4; step++) {
      if (cycle[step % cycle.length]) hits.add(step);
    }
  }
  return [...hits].sort((a, b) => a - b);
}

describe("Electro Backbeat", () => {
  it("keeps the 808 backbeat beneath pitched synth phrases and a fourth-bar pickup", () => {
    const patch = createPresetPatch("electro-backbeat", 61);
    expect(patch.vol).toBe(61);
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 6, 8, 14]);
    expect(hitsFor(patch, "snare", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "clap", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "lead", 2)).toEqual([3, 11]);
    expect(hitsFor(patch, "oh", 4)).toEqual([62]);
    const bassHits = hitsFor(patch, "bassline", 4);
    expect(bassHits.filter((step) => step < 48)).toHaveLength(15);
    expect(bassHits.filter((step) => step >= 48)).toHaveLength(7);
    for (const id of ["bassline", "lead"] as const) {
      const route = patch.voices[id].modulations.find((route) => route.destination === "vOct")!;
      expect(patch.blocks[Number(route.source)]).toMatchObject({ kind: "modulator", pulses: 1, mute: false });
    }
    expect(patch.voices.bassline.custom.scale).toBe(patch.voices.lead.custom.scale);
    expect(patch.voices.bassline.custom.root).toBe(patch.voices.lead.custom.root);
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.kick.reverb).toBe(0);
  });

  it("develops the song with a lift, a reliable breakdown and a second-bar tom turnaround", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("electro-backbeat").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "bassline", 4).length).toBeGreaterThan(hitsFor(groove, "bassline", 4).length);
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(fill, "mt", 2)).toEqual([28]);
    expect(hitsFor(fill, "lt", 2)).toEqual([30]);
    expect(hitsFor(fill, "bassline", 2).some((step) => step >= 28)).toBe(false);
  });

});

describe("Electro-Funk with Maracas", () => {
  it("keeps the original drum groove and answers the bass in the second bar", () => {
    const patch = createPresetPatch("electro-funk-maracas", 63);
    expect(patch).toMatchObject({ bpm: 112, swing: 0, vol: 63 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 7, 10]);
    expect(hitsFor(patch, "clap", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "mt", 1)).toEqual([6, 14]);
    expect(hitsFor(patch, "lt", 1)).toEqual([7, 15]);
    expect(hitsFor(patch, "shk", 1)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(hitsFor(patch, "bassline", 1)).toEqual([1, 5, 9, 13]);
    expect(hitsFor(patch, "lead", 2)).toEqual([19, 27]);
    expect(hitsFor(patch, "mt", 4).filter((step) => step >= 48)).toEqual([50, 54, 58, 62]);
    expect(hitsFor(patch, "lt", 4).filter((step) => step >= 48)).toEqual([51, 55, 59, 63]);
    for (const id of ["bassline", "lead"] as const) {
      expect(patch.voices[id].custom).toMatchObject({ root: 2, scale: 5 });
    }
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.shk).toEqual({ reverb: 0, delay: 0, distortion: 0, compressor: 0, karplus: 0 });
  });

  it("accents alternate maraca hits at both full and reduced density", () => {
    const arrangement = createPresetArrangement("electro-funk-maracas");
    for (const variation of [0, 2]) {
      const patch = arrangement.variations[variation].patch;
      const voice = patch.voices.shk;
      const source = patch.blocks[Number(voice.modulations[0].source)];
      const modulationAt = (step: number) => effectiveVoiceModulation(voice, () => euclideanLfoValue(source.shape, step, source, 0.5)).level;
      const hits = hitsFor(patch, "shk", 1);
      expect(modulationAt(hits[0])).toBeGreaterThan(0);
      expect(modulationAt(hits[1])).toBeLessThan(0);
      expect(modulationAt(hits[2])).toBe(modulationAt(hits[0]));
    }
  });

  it("adds a percussion lift and clears the final beat for a four-hit turnaround", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("electro-funk-maracas").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "bassline", 4).length).toBeGreaterThan(hitsFor(groove, "bassline", 4).length);
    expect(hitsFor(lift, "rim", 1)).toEqual([3, 11]);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "cow", 2)).toEqual([]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(fill, "ht", 2)).toEqual([28]);
    expect(hitsFor(fill, "mt", 2)).toEqual([6, 14, 29]);
    expect(hitsFor(fill, "rim", 2)).toEqual([30]);
    expect(hitsFor(fill, "lt", 2)).toEqual([7, 15, 31]);
    expect(hitsFor(fill, "shk", 2)).toEqual(Array.from({ length: 28 }, (_, index) => index));
    expect(hitsFor(fill, "bassline", 2).some((step) => step >= 28)).toBe(false);
    expect(hitsFor(fill, "lead", 2).some((step) => step >= 16)).toBe(false);
    expect(hitsFor(fill, "shk", 3)).toContain(32);
  });
});

describe("Stripped 808 Breakbeat", () => {
  it("preserves the swung break beneath a sparse bass motif and alternate-bar lead", () => {
    const patch = createPresetPatch("stripped-808-breakbeat", 59);
    expect(patch).toMatchObject({ bpm: 104, swing: 8, vol: 59 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 6, 10]);
    expect(hitsFor(patch, "snare", 1)).toEqual([4, 11, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 15]);
    expect(hitsFor(patch, "oh", 4)).toEqual([14, 30, 46]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([1, 9, 17, 25, 33, 41, 53, 61]);
    expect(hitsFor(patch, "lead", 4)).toEqual([23, 55]);
    expect(patch.effects.compressor.enabled).toBe(true);
    expect(patch.effects.sends.kick.compressor).toBeGreaterThan(0);
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch", "oh"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("softens the snare pickup and quantizes the bass to E and B", () => {
    const patch = createPresetPatch("stripped-808-breakbeat");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    expect(modulationAt("snare", 11).level).toBeLessThan(modulationAt("snare", 12).level);
    expect(modulationAt("snare", 4).level).toBe(modulationAt("snare", 12).level);
    expect(modulationAt("ch", 15).level).toBeLessThan(modulationAt("ch", 12).level);
    const notes = hitsFor(patch, "bassline", 1).map((step) => quantizeVoiceCv(patch.voices.bassline.custom, modulationAt("bassline", step).vOct).name);
    expect(notes).toEqual(["B1", "E1"]);
    expect(patch.voices.lead.custom).toMatchObject({ root: 4, scale: 2 });
  });

  it("lifts without changing the break, then strips back and leaves a rim answer", () => {
    const [groove, lift, breakdown, ending] = createPresetArrangement("stripped-808-breakbeat").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(lift, "bassline", 4).length).toBeGreaterThan(hitsFor(groove, "bassline", 4).length);
    expect(hitsFor(lift, "rim", 4)).toEqual([63]);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 10, 16, 26]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 25]);
    expect(hitsFor(ending, "ch", 2)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 26]);
    expect(hitsFor(ending, "rim", 2)).toEqual([31]);
    expect(hitsFor(ending, "snare", 2)).toContain(28);
    expect(hitsFor(ending, "bassline", 2)).toEqual([1, 9, 17]);
    expect(hitsFor(ending, "lead", 2)).toEqual([3]);
    expect(hitsFor(ending, "oh", 2)).toEqual([14]);
    expect(hitsFor(ending, "ch", 3)).toContain(32);
  });
});

describe("Bass Tempo Standard", () => {
  it("preserves the fast 808 groove and fits the synth riff between kick attacks", () => {
    const patch = createPresetPatch("bass-tempo-standard", 65);
    expect(patch).toMatchObject({ bpm: 135, swing: 0, vol: 65 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 6, 10, 14]);
    expect(hitsFor(patch, "clap", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual(Array.from({ length: 16 }, (_, step) => step));
    expect(hitsFor(patch, "oh", 1)).toEqual([14]);
    expect(hitsFor(patch, "cow", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "bassline", 1)).toEqual([1, 5, 9, 13]);
    expect(hitsFor(patch, "lead", 2)).toEqual([8, 19, 27]);
    expect(hitsFor(patch, "ch", 4).filter((step) => step >= 48)).toEqual([48, 50, 52, 54, 56, 58, 60, 62]);
    expect(hitsFor(patch, "cow", 4).filter((step) => step >= 48)).toEqual([50, 58]);
    expect(patch.voices.bassline.custom).toMatchObject({ root: 5, scale: 2, octave: 2 });
    expect(patch.voices.lead.custom).toMatchObject({ root: 5, scale: 2, octave: 4 });
    expect(patch.effects.sends.kick).toEqual({ distortion: 0, reverb: 0, delay: 0, karplus: 0, compressor: 0 });
    expect(patch.effects.distortion.enabled).toBe(true);
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const { patch: variation } of createPresetArrangement("bass-tempo-standard").variations.slice(0, 2)) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("accents alternating hats and builds the final snare roll in level", () => {
    const variations = createPresetArrangement("bass-tempo-standard").variations;
    const modulationAt = (patch: Patch, voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    }).level;
    for (const index of [0, 2]) {
      const patch = variations[index].patch;
      const [first, second, third] = hitsFor(patch, "ch", 1);
      expect(modulationAt(patch, "ch", first)).toBeGreaterThan(modulationAt(patch, "ch", second));
      expect(modulationAt(patch, "ch", first)).toBe(modulationAt(patch, "ch", third));
    }
    const fill = variations[3].patch;
    const levels = hitsFor(fill, "snare", 2).map((step) => modulationAt(fill, "snare", step));
    expect(levels).toHaveLength(4);
    expect(levels[0]).toBeLessThan(0);
    expect(levels[3]).toBeGreaterThan(0);
    expect(levels.every((level, index) => index === 0 || level > levels[index - 1])).toBe(true);
  });

  it("lifts the melody, drops the kick for one bar, and clears space for the roll", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("bass-tempo-standard").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "clap", 4)).toEqual(hitsFor(groove, "clap", 4));
    expect(hitsFor(lift, "bassline", 4).length).toBeGreaterThan(hitsFor(groove, "bassline", 4).length);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([16, 22, 26, 30]);
    expect(hitsFor(breakdown, "kick", 4)).toEqual([16, 22, 26, 30, 48, 54, 58, 62]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 1)).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
    expect(hitsFor(breakdown, "cow", 2)).toEqual([]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(fill, "snare", 2)).toEqual([28, 29, 30, 31]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 28 }, (_, step) => step));
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 5, 9, 13, 17, 25]);
    expect(hitsFor(fill, "lead", 2)).toEqual([8]);
    expect(hitsFor(fill, "oh", 2)).toEqual([14]);
    expect(hitsFor(fill, "cow", 2)).toEqual([2, 6, 10, 14, 18]);
    expect(hitsFor(fill, "snare", 4)).toEqual([28, 29, 30, 31, 60, 61, 62, 63]);
    expect(hitsFor(fill, "ch", 3)).toContain(32);
  });
});

describe("Double-Time Bass", () => {
  it("preserves the rapid kick groove and the cymbal's two-bar cycle", () => {
    const patch = createPresetPatch("double-time-bass", 62);
    expect(patch).toMatchObject({ bpm: 145, rate: 4, swing: 0, vol: 62 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 3, 6, 8, 11, 14]);
    expect(hitsFor(patch, "snare", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual(Array.from({ length: 16 }, (_, step) => step));
    expect(hitsFor(patch, "shk", 1)).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
    expect(hitsFor(patch, "cym", 4)).toEqual([0, 32]);
    expect(hitsFor(patch, "bassline", 2)).toEqual([2, 10, 21, 29]);
    expect(hitsFor(patch, "lead", 4)).toEqual([7, 23, 39, 55, 63]);
    expect(patch.voices.bassline.custom).toMatchObject({ root: 7, scale: 5, octave: 2 });
    expect(patch.voices.lead.custom).toMatchObject({ root: 7, scale: 5, octave: 3 });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/16" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.compressor.enabled).toBe(true);
    for (const voice of ["kick", "bassline", "ch", "shk", "cym"] as const) {
      expect(patch.effects.sends[voice].delay).toBe(0);
      expect(patch.effects.sends[voice].reverb).toBe(0);
    }
    for (const { patch: variation } of createPresetArrangement("double-time-bass").variations.slice(0, 2)) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("counter-accents hats and shaker, interlocks their fourth bar, and keeps the bass on root/fifth", () => {
    const patch = createPresetPatch("double-time-bass");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    expect(modulationAt("ch", 1).level).toBeGreaterThan(modulationAt("ch", 3).level);
    expect(modulationAt("shk", 1).level).toBeLessThan(modulationAt("shk", 3).level);
    const hats = new Set(hitsFor(patch, "ch", 4).filter((step) => step >= 48));
    const shaker = hitsFor(patch, "shk", 4).filter((step) => step >= 48);
    expect(shaker.some((step) => hats.has(step))).toBe(false);
    expect(new Set([...hats, ...shaker]).size).toBe(16);
    const notes = hitsFor(patch, "bassline", 1).map((step) => quantizeVoiceCv(patch.voices.bassline.custom, modulationAt("bassline", step).vOct).name);
    expect(notes).toEqual(["D3", "G2"]);
  });

  it("adds a melodic lift, a half-time break, and a final percussion response", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("double-time-bass").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(lift, "bassline", 4)).toHaveLength(16);
    expect(hitsFor(lift, "lead", 4).length).toBeGreaterThan(hitsFor(groove, "lead", 4).length);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([8, 24]);
    expect(hitsFor(breakdown, "shk", 1)).toEqual([3, 7, 11, 15]);
    expect(hitsFor(breakdown, "cym", 2)).toEqual([]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 3, 6, 8, 11, 14, 16, 24]);
    expect(hitsFor(fill, "snare", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(fill, "rim", 2)).toEqual([29, 31]);
    expect(hitsFor(fill, "lt", 2)).toEqual([30]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 28 }, (_, step) => step));
    expect(hitsFor(fill, "shk", 2)).toEqual(Array.from({ length: 14 }, (_, step) => step * 2 + 1));
    expect(hitsFor(fill, "bassline", 2)).toEqual([2, 10, 17, 25]);
    expect(hitsFor(fill, "lead", 2)).toEqual([7]);
    expect(hitsFor(fill, "cym", 4)).toEqual([0, 32]);
    expect(hitsFor(fill, "rim", 4)).toEqual([29, 31, 61, 63]);
  });
});

describe("Half-Time Bass Groove", () => {
  it("preserves the half-time drums and develops a spacious two-bar synth phrase", () => {
    const patch = createPresetPatch("half-time-bass-groove", 64);
    expect(patch).toMatchObject({ bpm: 142, rate: 4, swing: 0, vol: 64 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 6, 13]);
    expect(hitsFor(patch, "clap", 2)).toEqual([8, 24]);
    expect(hitsFor(patch, "ch", 1)).toEqual(Array.from({ length: 16 }, (_, step) => step));
    expect(hitsFor(patch, "ch", 2).filter((step) => step >= 16)).toEqual([16, 18, 20, 22, 24, 26, 28, 30]);
    expect(hitsFor(patch, "oh", 2)).toEqual([3, 11, 19, 27]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([2, 10, 18, 26, 34, 42, 58]);
    expect(hitsFor(patch, "lead", 4)).toEqual([4, 28, 36, 60]);
    expect(patch.voices.bassline.custom).toMatchObject({ root: 3, scale: 5, octave: 2 });
    expect(patch.voices.lead.custom).toMatchObject({ root: 3, scale: 5, octave: 3 });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/4" });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.lead.reverb).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline"] as const) {
      expect(patch.effects.sends[voice]).toEqual({ distortion: 0, reverb: 0, delay: 0, karplus: 0, compressor: 0 });
    }
  });

  it("spreads the pitch progression over two bars and accents the half-time pulse", () => {
    const patch = createPresetPatch("half-time-bass-groove");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notes = hitsFor(patch, "bassline", 2).map((step) => quantizeVoiceCv(patch.voices.bassline.custom, modulationAt("bassline", step).vOct).midi);
    // E-flat, G-flat, B-flat, D-flat across the two-bar phrase.
    expect(notes).toEqual([39, 42, 46, 49]);
    expect(modulationAt("ch", 0).level).toBeGreaterThan(modulationAt("ch", 4).level);
    expect(modulationAt("ch", 8).level).toBe(modulationAt("ch", 0).level);
    for (const { patch: variation } of createPresetArrangement("half-time-bass-groove").variations.slice(0, 2)) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("keeps the half-time clap through the lift, breakdown and tom-rim ending", () => {
    const patches = createPresetArrangement("half-time-bass-groove").variations.map(({ patch }) => patch);
    const [groove, lift, breakdown, fill] = patches;
    for (const patch of patches) expect(hitsFor(patch, "clap", 2)).toEqual([8, 24]);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "bassline", 4).length).toBeGreaterThan(hitsFor(groove, "bassline", 4).length);
    expect(hitsFor(lift, "rim", 4)).toEqual([63]);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 16]);
    expect(hitsFor(breakdown, "ch", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([2, 26]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 6, 13, 16, 22]);
    expect(hitsFor(fill, "lt", 2)).toEqual([30]);
    expect(hitsFor(fill, "rim", 2)).toEqual([31]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 28 }, (_, step) => step));
    expect(hitsFor(fill, "oh", 2)).toEqual([3, 11, 19]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([2, 10, 18]);
    expect(hitsFor(fill, "lead", 2)).toEqual([4, 26]);
    expect(hitsFor(fill, "kick", 3)).toContain(45);
    expect(hitsFor(fill, "rim", 4)).toEqual([31, 63]);
  });
});

describe("Boom Bap", () => {
  it("preserves the swung drum groove and adds a restrained fourth-bar pickup", () => {
    const patch = createPresetPatch("boom-bap", 63);
    expect(patch).toMatchObject({ bpm: 90, rate: 4, swing: 16, vol: 63 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 6, 10]);
    expect(hitsFor(patch, "snare", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 3, 4, 6, 8, 10, 11, 12, 14]);
    expect(hitsFor(patch, "snare", 4)).toEqual([4, 12, 20, 28, 36, 44, 51, 52, 59, 60]);
    expect(hitsFor(patch, "oh", 4)).toEqual([14, 30, 46]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([1, 7, 12, 17, 23, 28, 33, 39, 44, 49, 57]);
    expect(hitsFor(patch, "lead", 4)).toEqual([3, 11, 35, 43]);
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: false, time: 95 });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.compressor.enabled).toBe(true);
    expect(patch.effects.sends.snare.compressor).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("plays D Dorian and keeps hat and snare pickups softer than the main hits", () => {
    const patch = createPresetPatch("boom-bap");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notes = hitsFor(patch, "bassline", 1).map((step) => quantizeVoiceCv(patch.voices.bassline.custom, modulationAt("bassline", step).vOct).midi);
    // D, G and B: the natural sixth distinguishes Dorian from natural minor.
    expect(notes).toEqual([38, 43, 47]);
    expect(patch.voices.lead.custom).toMatchObject({ root: 2, scale: 3, waveform: 2 });
    for (const voice of ["ch", "snare"] as const) {
      expect(modulationAt(voice, 3).level).toBeLessThan(modulationAt(voice, 4).level);
      expect(modulationAt(voice, 11).level).toBeLessThan(modulationAt(voice, 12).level);
    }
  });

  it("adds a ghost-snare lift, strips back the break and leaves a short rim ending", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("boom-bap").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 1)).toEqual([3, 4, 11, 12]);
    expect(hitsFor(lift, "bassline", 4).length).toBeGreaterThan(hitsFor(groove, "bassline", 4).length);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 10, 16, 26]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 9, 25]);
    expect(hitsFor(fill, "snare", 2)).toEqual([4, 12, 20, 27, 28]);
    expect(hitsFor(fill, "rim", 2)).toEqual([30]);
    expect(hitsFor(fill, "ch", 2)).toEqual([0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 7, 12, 17]);
    expect(hitsFor(fill, "lead", 2)).toEqual([3, 11]);
    expect(hitsFor(fill, "oh", 2)).toEqual([14]);
    expect(hitsFor(fill, "rim", 4)).toEqual([30, 62]);
    expect(hitsFor(fill, "ch", 3)).toContain(35);
  });
});

describe("Sparse 808 Ballad", () => {
  it("preserves the slow drum groove and alternates the tom and synth responses", () => {
    const patch = createPresetPatch("sparse-808-ballad", 60);
    expect(patch).toMatchObject({ bpm: 78, rate: 4, swing: 8, vol: 60 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 10]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "ch", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "lt", 4)).toEqual([14, 15, 46, 47]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([1, 25, 33, 57]);
    expect(hitsFor(patch, "lead", 4)).toEqual([5, 29, 37, 61]);
    expect(patch.voices.bassline.custom).toMatchObject({ root: 9, scale: 1, octave: 2 });
    expect(patch.voices.lead.custom).toMatchObject({ root: 9, scale: 1, octave: 3 });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "hall" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/2" });
    expect(patch.effects.sends.lead.reverb).toBeGreaterThan(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline"] as const) {
      expect(patch.effects.sends[voice]).toEqual({ distortion: 0, reverb: 0, delay: 0, karplus: 0, compressor: 0 });
    }
  });

  it("plays a root/fifth bass with an A-major response and a softer second tom", () => {
    const patch = createPresetPatch("sparse-808-ballad");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["A2", "E3"]);
    expect(notesFor("lead")).toEqual(["B3", "E4"]);
    expect(modulationAt("lt", 15).level).toBeLessThan(modulationAt("lt", 14).level);
    for (const { patch: variation } of createPresetArrangement("sparse-808-ballad").variations.slice(0, 2)) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("lifts gently, substitutes a rim backbeat in the break and closes with descending toms", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("sparse-808-ballad").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "clap", 4)).toEqual(hitsFor(groove, "clap", 4));
    expect(hitsFor(lift, "ch", 4)).toEqual(hitsFor(groove, "ch", 4));
    expect(hitsFor(lift, "bassline", 2)).toEqual([1, 9, 21, 29]);
    expect(hitsFor(lift, "lead", 2)).toEqual([5, 13, 25]);
    expect(hitsFor(lift, "rim", 4)).toEqual([59]);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 16]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([]);
    expect(hitsFor(breakdown, "rim", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 1)).toEqual([6, 14]);
    expect(hitsFor(breakdown, "lt", 2)).toEqual([]);
    expect(hitsFor(fill, "mt", 2)).toEqual([30]);
    expect(hitsFor(fill, "lt", 2)).toEqual([14, 15, 31]);
    expect(hitsFor(fill, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 17]);
    expect(hitsFor(fill, "lead", 2)).toEqual([5]);
    expect(hitsFor(fill, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(fill, "mt", 4)).toEqual([30, 62]);
    expect(hitsFor(fill, "ch", 3)).toContain(34);
  });
});

describe("Modern 808 Hip Hop", () => {
  it("preserves the swung drum pattern beneath a two-bar minor phrase", () => {
    const patch = createPresetPatch("modern-808-hip-hop", 64);
    expect(patch).toMatchObject({ bpm: 84, rate: 4, swing: 12, vol: 64 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 6, 10]);
    expect(hitsFor(patch, "snare", 1)).toEqual([4, 12]);
    expect(hitsFor(patch, "rim", 1)).toEqual([2, 10]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 5, 6, 8, 10, 12, 13, 14]);
    expect(hitsFor(patch, "oh", 4)).toEqual([8, 40]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([1, 9, 19, 27, 33, 41, 51, 59]);
    expect(hitsFor(patch, "lead", 4)).toEqual([7, 19, 39, 51]);
    expect(patch.effects.distortion.enabled).toBe(true);
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("voices F-sharp minor with softer hat pickups and space between bass and kick attacks", () => {
    const patch = createPresetPatch("modern-808-hip-hop");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["F♯2", "C♯3", "E3", "A2"]);
    expect(notesFor("lead")).toEqual(["B4", "A♭4"]);
    expect(modulationAt("ch", 5).level).toBeLessThan(modulationAt("ch", 4).level);
    expect(modulationAt("ch", 13).level).toBeLessThan(modulationAt("ch", 12).level);
    for (const { patch: variation } of createPresetArrangement("modern-808-hip-hop").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("lifts the melody, breaks to rim-led drums and saves the hat roll for the final beat", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("modern-808-hip-hop").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(lift, "ch", 4)).toEqual(hitsFor(groove, "ch", 4));
    expect(hitsFor(lift, "bassline", 2)).toEqual([1, 5, 9, 13, 19, 23, 27, 31]);
    expect(hitsFor(lift, "lead", 2)).toEqual([7, 15, 19, 27]);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 10, 16, 26]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([]);
    expect(hitsFor(breakdown, "rim", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 19]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 9, 19]);
    expect(hitsFor(fill, "lead", 2)).toEqual([7]);
    expect(hitsFor(fill, "rim", 2)).toEqual([2, 10, 30]);
    expect(hitsFor(fill, "snare", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(fill, "ch", 2).filter((step) => step >= 16)).toEqual([16, 18, 20, 22, 24, 26, 28, 29, 30, 31]);
    // Check individual layers as well as their union: the roll must not
    // double-trigger hats already played by the main eighth-note pattern.
    const hatLayers = fill.blocks.filter((block) => block.voice === "ch").map((block) =>
      rhythmsFor(block).flatMap((rhythm) => Array.from({ length: rhythm.steps * rhythm.repeats }, (_, step) => euclidHit(step % rhythm.steps, rhythm.steps, rhythm.pulses, rhythm.rot))));
    for (let step = 0; step < 64; step++) {
      expect(hatLayers.filter((cycle) => cycle[step % cycle.length])).toHaveLength(hitsFor(fill, "ch", 4).includes(step) ? 1 : 0);
    }
    expect(hitsFor(fill, "ch", 3)).toContain(37);
  });
});

describe("Trap Standard", () => {
  it("preserves the 32-step trap groove and phrases the synths across full bars", () => {
    const patch = createPresetPatch("trap-standard", 65);
    expect(patch).toMatchObject({ bpm: 140, rate: 8, swing: 0, vol: 65 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 12, 24]);
    expect(hitsFor(patch, "snare", 2)).toEqual([16, 48]);
    expect(hitsFor(patch, "clap", 2)).toEqual([16, 48]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 29, 30]);
    expect(hitsFor(patch, "oh", 4)).toEqual([22, 54, 86]);
    expect(hitsFor(patch, "ch", 4).filter((step) => step >= 96)).toEqual(Array.from({ length: 16 }, (_, index) => 96 + index * 2));
    expect(hitsFor(patch, "bassline", 4)).toEqual([4, 20, 38, 54, 68, 84, 102, 118]);
    expect(hitsFor(patch, "lead", 4)).toEqual([10, 26, 74, 90]);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "hall" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/4" });
    expect(patch.effects.sends.lead.reverb).toBeGreaterThan(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.distortion.enabled).toBe(true);
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("plays root/fifth bass and minor-pentatonic bells with softer hat and snare pickups", () => {
    const patch = createPresetPatch("trap-standard");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["F2", "C3", "F2", "C3"]);
    expect(notesFor("lead")).toEqual(["A♭4", "E♭5"]);
    expect(modulationAt("ch", 2).level).toBeLessThan(modulationAt("ch", 0).level);
    expect(modulationAt("ch", 13).level).toBeLessThan(modulationAt("ch", 12).level);
    expect(modulationAt("ch", 29).level).toBeLessThan(modulationAt("ch", 28).level);
    for (const { patch: variation } of createPresetArrangement("trap-standard").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
    const fill = createPresetArrangement("trap-standard").variations[3].patch;
    const snareLevelAt = (step: number) => effectiveVoiceModulation(fill.voices.snare, (source) => {
      const block = fill.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    }).level;
    expect(snareLevelAt(60)).toBeLessThan(snareLevelAt(48));
    expect(snareLevelAt(62)).toBeLessThan(snareLevelAt(48));
  });

  it("adds a melodic lift, strips back to clap and ends with a second-bar snare/rim reply", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("trap-standard").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(lift, "clap", 4)).toEqual(hitsFor(groove, "clap", 4));
    expect(hitsFor(lift, "bassline", 2)).toEqual([4, 15, 26, 38, 49, 60]);
    expect(hitsFor(lift, "lead", 2)).toEqual([10, 26, 50]);
    expect(hitsFor(lift, "ch", 4).filter((step) => step >= 96 && step % 2)).toEqual([101, 109, 117, 125]);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 32]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([16, 48]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual(Array.from({ length: 16 }, (_, index) => index * 4));
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([4]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([10, 58]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 12, 24, 32, 44]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([4, 20, 36]);
    expect(hitsFor(fill, "lead", 2)).toEqual([10, 26]);
    expect(hitsFor(fill, "snare", 2)).toEqual([16, 48, 60, 62]);
    expect(hitsFor(fill, "rim", 4)).toEqual([63, 127]);
    expect(hitsFor(fill, "ch", 2).filter((step) => step >= 32)).toEqual(Array.from({ length: 14 }, (_, index) => 32 + index * 2));
    expect(hitsFor(fill, "ch", 3)).toContain(77);
    expect(hitsFor(fill, "kick", 3)).toContain(88);
  });
});

describe("Triplet Trap", () => {
  it("preserves the swung half-time drums and leaves room for a second-bar synth response", () => {
    const patch = createPresetPatch("triplet-trap", 62);
    expect(patch).toMatchObject({ bpm: 144, rate: 4, swing: 33, vol: 62 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 5, 12]);
    expect(hitsFor(patch, "snare", 2)).toEqual([8, 24]);
    expect(hitsFor(patch, "rim", 2)).toEqual([6, 14, 22, 30]);
    expect(hitsFor(patch, "ch", 1)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(hitsFor(patch, "ch", 4).filter((step) => step >= 48)).toEqual([48, 50, 52, 54, 56, 58, 60, 62]);
    expect(hitsFor(patch, "oh", 4)).toEqual([63]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([2, 10, 19, 27, 34, 42, 51, 59]);
    expect(hitsFor(patch, "lead", 4)).toEqual([19, 27, 51, 59]);
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8T" });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.rim.delay).toBeGreaterThan(0);
    expect(patch.effects.compressor.enabled).toBe(true);
    expect(patch.effects.sends.kick.compressor).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("outlines A minor across two bars and softens the delayed hats and snare anticipation", () => {
    const patch = createPresetPatch("triplet-trap");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["A2", "C3", "E3", "G3"]);
    expect(notesFor("lead")).toEqual(["G4", "C4"]);
    expect(modulationAt("ch", 1).level).toBeLessThan(modulationAt("ch", 0).level);
    expect(modulationAt("ch", 15).level).toBeLessThan(modulationAt("ch", 14).level);
    expect(modulationAt("snare", 27).level).toBeLessThan(modulationAt("snare", 24).level);
    for (const { patch: variation } of createPresetArrangement("triplet-trap").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("lifts the call/response, keeps swing in the break and closes with a spaced percussion reply", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("triplet-trap").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(lift, "rim", 4)).toEqual(hitsFor(groove, "rim", 4));
    expect(hitsFor(lift, "bassline", 2)).toEqual([2, 6, 10, 14, 19, 23, 27, 31]);
    expect(hitsFor(lift, "lead", 2)).toEqual([3, 11, 19, 27]);
    expect(hitsFor(lift, "oh", 4)).toEqual([15, 31, 47, 63]);
    expect(hitsFor(lift, "ch", 4)).toHaveLength(64);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 12, 16, 28]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([8, 24]);
    expect(hitsFor(breakdown, "rim", 2)).toEqual([14]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual(Array.from({ length: 16 }, (_, index) => index * 2 + 1));
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([2]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([19, 27]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 5, 12, 16, 21]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([2, 10, 19]);
    expect(hitsFor(fill, "lead", 2)).toEqual([19]);
    expect(hitsFor(fill, "snare", 2)).toEqual([8, 24, 27]);
    expect(hitsFor(fill, "rim", 2)).toEqual([6, 14, 29]);
    expect(hitsFor(fill, "lt", 4)).toEqual([30, 62]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 28 }, (_, index) => index));
    for (const voice of Object.keys(fill.voices) as VoiceId[]) {
      expect(hitsFor(fill, voice, 2)).not.toContain(31);
    }
    expect(hitsFor(fill, "kick", 3)).toContain(44);
    expect(hitsFor(fill, "ch", 3)).toContain(47);
  });
});

describe("Drill Variant", () => {
  it("preserves the first bar and develops the backbeat and melody across the 32-step grid", () => {
    const patch = createPresetPatch("drill-variant", 63);
    expect(patch).toMatchObject({ bpm: 142, rate: 8, swing: 16, vol: 63 });
    expect(hitsFor(patch, "kick", 2)).toEqual([0, 16, 32, 48]);
    expect(hitsFor(patch, "snare", 4)).toEqual([16, 52, 80, 116]);
    expect(hitsFor(patch, "rim", 4)).toEqual([8, 40, 72, 120]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 4, 8, 12, 13, 16, 20, 24, 28, 29]);
    expect(hitsFor(patch, "ch", 2).filter((step) => step >= 32)).toEqual([32, 36, 40, 44, 48, 52, 56, 60]);
    expect(hitsFor(patch, "bassline", 2)).toEqual([3, 14, 25, 38, 54]);
    expect(hitsFor(patch, "lead", 4)).toEqual([11, 59, 75, 123]);
    expect(patch.effects.distortion).toMatchObject({ enabled: true, mode: "soft" });
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D" });
    expect(patch.effects.sends.lead.reverb).toBeGreaterThan(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("plays octave bass in D minor and makes the fast hat pickups quieter", () => {
    const patch = createPresetPatch("drill-variant");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["D2", "D2", "D3", "D2", "D3"]);
    expect(notesFor("lead")).toEqual(["B♭4", "F4"]);
    expect(modulationAt("ch", 13).level).toBeLessThan(modulationAt("ch", 12).level);
    expect(modulationAt("ch", 29).level).toBeLessThan(modulationAt("ch", 28).level);
    expect(modulationAt("ch", 61).level).toBeLessThan(modulationAt("ch", 60).level);
    expect(quantizeVoiceCv(patch.voices.bassline.custom, modulationAt("bassline", 62).vOct).name).toBe("D3");
    for (const { patch: variation } of createPresetArrangement("drill-variant").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("builds a lift, drops to a rim backbeat and exposes an octave pickup after the hat stutter", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("drill-variant").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(lift, "snare", 4)).toEqual(hitsFor(groove, "snare", 4));
    expect(hitsFor(lift, "bassline", 2)).toEqual([3, 11, 19, 27, 38, 46, 54, 62]);
    expect(hitsFor(lift, "lead", 2)).toEqual([11, 27, 51]);
    expect(hitsFor(lift, "ch", 2)).toContain(45);
    expect(hitsFor(lift, "ch", 2)).toContain(61);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 32]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([]);
    expect(hitsFor(breakdown, "rim", 2)).toEqual([16, 48]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([4, 12, 20, 28, 36, 44, 52, 60]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([3, 38]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([11, 59]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 16, 32]);
    expect(hitsFor(fill, "snare", 2)).toEqual([16, 52]);
    expect(hitsFor(fill, "rim", 2)).toEqual([8, 40]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([3, 14, 25, 38, 62]);
    expect(hitsFor(fill, "lead", 2)).toEqual([11]);
    expect(hitsFor(fill, "ch", 2).filter((step) => step >= 32)).toEqual([32, 36, 40, 44, 48, 52, 56, 60, 61]);
    // The stutter replaces the main hat at step 60 instead of doubling it.
    const hatLayers = fill.blocks.filter((block) => block.voice === "ch").map((block) =>
      rhythmsFor(block).flatMap((rhythm) => Array.from({ length: rhythm.steps * rhythm.repeats }, (_, step) => euclidHit(step % rhythm.steps, rhythm.steps, rhythm.pulses, rhythm.rot))));
    for (const step of [60, 61, 124, 125]) {
      expect(hatLayers.filter((cycle) => cycle[step % cycle.length])).toHaveLength(1);
    }
    for (const voice of Object.keys(fill.voices) as VoiceId[]) {
      expect(hitsFor(fill, voice, 2)).not.toContain(63);
    }
    expect(hitsFor(fill, "bassline", 4)).toContain(126);
    expect(hitsFor(fill, "kick", 3)).toContain(80);
    expect(hitsFor(fill, "ch", 3)).toContain(93);
  });
});

describe("Basic House", () => {
  it("keeps the 909/808 house foundation beneath offbeat bass and a two-bar hook", () => {
    const patch = createPresetPatch("basic-house", 64);
    expect(patch).toMatchObject({ bpm: 122, rate: 4, swing: 0, vol: 64 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.ch.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("808");
    expect(hitsFor(patch, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 51, 59]);
    expect(hitsFor(patch, "lead", 4)).toEqual([3, 11, 35, 43]);
    expect(hitsFor(patch, "rim", 4)).toEqual([63]);
    expect(hitsFor(patch, "shk", 4)).toEqual([]);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.clap.reverb).toBeGreaterThan(0);
    expect(patch.effects.compressor.enabled).toBe(true);
    for (const voice of ["kick", "bassline", "ch", "shk"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("voices a C Mixolydian hook and accents alternate offbeat hats", () => {
    const patch = createPresetPatch("basic-house");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["C2", "C2", "G2", "G2", "C2", "C2", "G2", "G2"]);
    expect(notesFor("lead")).toEqual(["E4", "B♭4"]);
    expect(modulationAt("ch", 6).level).toBeLessThan(modulationAt("ch", 2).level);
    expect(modulationAt("ch", 14).level).toBeLessThan(modulationAt("ch", 10).level);
    expect(modulationAt("shk", 5).level).toBeLessThan(modulationAt("shk", 1).level);
    for (const { patch: variation } of createPresetArrangement("basic-house").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("adds a shaker lift, drops the kick for the break and keeps the floor pulse through the tom ending", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("basic-house").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "clap", "ch"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "bassline", 4)).toEqual(Array.from({ length: 16 }, (_, index) => 2 + index * 4));
    expect(hitsFor(lift, "lead", 2)).toEqual([3, 11, 23, 31]);
    expect(hitsFor(lift, "shk", 2)).toEqual(Array.from({ length: 16 }, (_, index) => 1 + index * 2));
    expect(hitsFor(breakdown, "kick", 2)).toEqual([]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([6, 14, 22, 30]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([2, 10, 18, 26]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([11, 19]);
    expect(hitsFor(breakdown, "rim", 4)).toEqual([]);
    expect(hitsFor(fill, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(fill, "clap", 4)).toEqual(hitsFor(groove, "clap", 4));
    expect(hitsFor(fill, "bassline", 2)).toEqual([2, 6, 10, 14, 18]);
    expect(hitsFor(fill, "lead", 2)).toEqual([3, 11]);
    expect(hitsFor(fill, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "mt", 4)).toEqual([29, 61]);
    expect(hitsFor(fill, "lt", 4)).toEqual([30, 62]);
    expect(hitsFor(fill, "rim", 4)).toEqual([31, 63]);
    expect(hitsFor(fill, "ch", 3)).toContain(46);
    expect(hitsFor(fill, "bassline", 3)).toContain(46);
  });
});

describe("Open-Hat House", () => {
  it("preserves the alternating hats and adds a bass phrase ahead of the offbeats", () => {
    const patch = createPresetPatch("open-hat-house", 63);
    expect(patch).toMatchObject({ bpm: 124, rate: 4, swing: 0, vol: 63 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.oh.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("808");
    expect(hitsFor(patch, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "ch", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(patch, "oh", 2)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 57]);
    expect(hitsFor(patch, "lead", 4)).toEqual([23, 31, 55, 63]);
    expect(hitsFor(patch, "cow", 4)).toEqual([51, 59]);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.clap.reverb).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch", "oh"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("voices F Dorian and varies open-hat length and accents without colliding with closed hats", () => {
    const patch = createPresetPatch("open-hat-house");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead", bars: number) => hitsFor(patch, voice, bars).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline", 1)).toEqual(["F2", "A♭2", "C3", "E♭3"]);
    expect(notesFor("lead", 2)).toEqual(["D4", "A♭3"]);
    expect(modulationAt("oh", 6).level).toBeLessThan(modulationAt("oh", 2).level);
    expect(modulationAt("oh", 6).decay).toBeLessThan(modulationAt("oh", 2).decay);
    expect(modulationAt("ch", 31).level).toBeLessThan(modulationAt("ch", 30).level);
    for (const { patch: variation } of createPresetArrangement("open-hat-house").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      const closedHats = new Set(hitsFor(variation, "ch", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
      expect(hitsFor(variation, "oh", 4).some((step) => closedHats.has(step))).toBe(false);
    }
  });

  it("lifts with cowbell, closes the hats in the break and hands the ending to a short hat pickup", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("open-hat-house").variations.map(({ patch }) => patch);
    for (const variation of [lift, breakdown, fill]) {
      expect(hitsFor(variation, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
      expect(hitsFor(variation, "clap", 4)).toEqual(hitsFor(groove, "clap", 4));
    }
    expect(hitsFor(lift, "bassline", 4)).toEqual(Array.from({ length: 16 }, (_, index) => 1 + index * 4));
    expect(hitsFor(lift, "lead", 2)).toEqual([7, 15, 19, 27]);
    expect(hitsFor(lift, "cow", 2)).toEqual([3, 11, 19, 27]);
    expect(hitsFor(lift, "oh", 4)).toEqual(hitsFor(groove, "oh", 4));
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 9, 17, 25]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([7, 27]);
    expect(hitsFor(breakdown, "cow", 4)).toEqual([]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 5, 9, 13, 17]);
    expect(hitsFor(fill, "lead", 2)).toEqual([7, 15]);
    expect(hitsFor(fill, "oh", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "ch", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 30, 31]);
    expect(hitsFor(fill, "rim", 4)).toEqual([29, 61]);
    expect(hitsFor(fill, "cow", 4)).toEqual([]);
    expect(hitsFor(fill, "oh", 3)).toContain(46);
    expect(hitsFor(fill, "ch", 3)).not.toContain(47);
    expect(hitsFor(fill, "ch", 4)).toContain(63);
  });
});

describe("Deep House Shuffle", () => {
  it("preserves the shuffled drum pattern and develops a spacious two-bar melody", () => {
    const patch = createPresetPatch("deep-house-shuffle", 61);
    expect(patch).toMatchObject({ bpm: 120, rate: 4, swing: 14, vol: 61 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("808");
    expect(hitsFor(patch, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]);
    expect(hitsFor(patch, "oh", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "rim", 1)).toEqual([7, 15]);
    expect(hitsFor(patch, "oh", 4).filter((step) => step >= 48)).toEqual([54, 62]);
    expect(hitsFor(patch, "rim", 4).filter((step) => step >= 48)).toEqual([55]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([3, 11, 17, 21, 25, 29, 35, 43, 49, 53, 57, 61]);
    expect(hitsFor(patch, "lead", 4)).toEqual([5, 29, 37, 61]);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/4" });
    expect(patch.effects.sends.lead.reverb).toBeGreaterThan(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const voice of ["kick", "bassline", "ch", "oh"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("voices E minor with a descending lead response and quieter shuffled pickups", () => {
    const patch = createPresetPatch("deep-house-shuffle");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["E2", "G2", "A2", "B2", "C3", "D3"]);
    expect(notesFor("lead")).toEqual(["G3", "F♯3"]);
    for (const step of [3, 7, 11, 15]) {
      expect(modulationAt("ch", step).level).toBeLessThan(modulationAt("ch", step - 1).level);
    }
    expect(modulationAt("clap", 31).level).toBeLessThan(modulationAt("clap", 28).level);
    for (const { patch: variation } of createPresetArrangement("deep-house-shuffle").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("lifts the melody, breaks to rim-led drums and makes space for a second-bar clap pickup", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("deep-house-shuffle").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "clap", "ch"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "bassline", 2)).toEqual([3, 7, 11, 15, 17, 21, 25, 29]);
    expect(hitsFor(lift, "lead", 2)).toEqual([5, 13, 25]);
    expect(hitsFor(lift, "rim", 2)).toEqual([3, 7, 11, 15, 19, 23, 27, 31]);
    expect(hitsFor(lift, "oh", 4)).toHaveLength(16);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([]);
    expect(hitsFor(breakdown, "rim", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([3, 25]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([5, 29]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(hitsFor(fill, "clap", 2)).toEqual([4, 12, 20, 28, 31]);
    expect(hitsFor(fill, "rim", 2)).toEqual([7, 15, 29]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([3, 11, 17, 25]);
    expect(hitsFor(fill, "lead", 2)).toEqual([5]);
    expect(hitsFor(fill, "ch", 2).filter((step) => step >= 16)).toEqual([16, 18, 19, 20, 22, 23, 24, 26, 27]);
    expect(hitsFor(fill, "oh", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "clap", 4)).toContain(63);
    expect(hitsFor(fill, "kick", 3)).toContain(44);
    expect(hitsFor(fill, "ch", 3)).toContain(47);
  });
});

describe("Jackin' House", () => {
  it("keeps the kick anticipation and 808 cowbell beneath a short two-bar bass phrase", () => {
    const patch = createPresetPatch("jackin-house", 62);
    expect(patch).toMatchObject({ bpm: 126, rate: 4, swing: 8, vol: 62 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("808");
    expect(patch.voices.cow.machine).toBe("808");
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 11, 12]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitsFor(patch, "oh", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "cow", 1)).toEqual([6, 14]);
    expect(hitsFor(patch, "oh", 4).filter((step) => step >= 48)).toEqual([50, 58]);
    expect(hitsFor(patch, "cow", 4).filter((step) => step >= 48)).toEqual([54]);
    expect(hitsFor(patch, "bassline", 2)).toEqual([1, 5, 9, 13, 18, 22, 26, 30]);
    expect(hitsFor(patch, "lead", 4)).toEqual([3, 11, 35, 43]);
    expect(hitsFor(patch, "shk", 4)).toEqual([]);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/16" });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.compressor.enabled).toBe(true);
    expect(patch.effects.sends.cow.compressor).toBeGreaterThan(0);
    expect(patch.effects.sends.cow.delay).toBe(0);
    for (const voice of ["kick", "bassline", "ch", "oh", "shk"] as const) {
      expect(patch.effects.sends[voice].reverb).toBe(0);
      expect(patch.effects.sends[voice].delay).toBe(0);
    }
  });

  it("outlines D Dorian and makes the ending's clap and final cowbell softer", () => {
    const patch = createPresetPatch("jackin-house");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["D2", "F2", "G2", "B2", "D2", "F2", "A2", "C3"]);
    expect(notesFor("lead")).toEqual(["A3", "D3"]);
    expect(modulationAt("ch", 2).level).toBeLessThan(modulationAt("ch", 0).level);
    expect(modulationAt("shk", 1).level).toBeLessThan(modulationAt("shk", 3).level);
    expect(modulationAt("clap", 30).level).toBeLessThan(modulationAt("clap", 28).level);
    expect(modulationAt("cow", 31).level).toBeLessThan(modulationAt("cow", 29).level);
    for (const { patch: variation } of createPresetArrangement("jackin-house").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("adds a shaker lift, strips back the syncopation and closes with a cowbell/clap reply", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("jackin-house").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "clap", "ch"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "lead", 2)).toEqual([3, 11, 23, 31]);
    expect(hitsFor(lift, "shk", 2)).toEqual(Array.from({ length: 16 }, (_, index) => 1 + index * 2));
    expect(hitsFor(lift, "cow", 4)).toHaveLength(8);
    expect(hitsFor(lift, "oh", 4)).toHaveLength(16);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "cow", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 9, 18, 26]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([3, 31]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 4, 8, 11, 12, 16, 20, 24, 28]);
    expect(hitsFor(fill, "clap", 2)).toEqual([4, 12, 20, 28, 30]);
    expect(hitsFor(fill, "cow", 2)).toEqual([6, 14, 29, 31]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 5, 9, 13, 18]);
    expect(hitsFor(fill, "lead", 2)).toEqual([3, 11]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 14 }, (_, index) => index * 2));
    expect(hitsFor(fill, "oh", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "cow", 4)).toContain(63);
    expect(hitsFor(fill, "kick", 3)).toContain(43);
    expect(hitsFor(fill, "oh", 3)).toContain(46);
  });
});

describe("Acid Basic", () => {
  it("preserves the 909 house pulse beneath a four-bar acid phrase and sparse 101 reply", () => {
    const patch = createPresetPatch("acid-basic", 60);
    expect(patch).toMatchObject({ bpm: 120, rate: 4, swing: 0, vol: 60 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("909");
    expect(hitsFor(patch, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "ch", 1)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(hitsFor(patch, "oh", 4)).toEqual([6, 14, 22, 30, 38, 46]);
    expect(hitsFor(patch, "bassline", 1)).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
    expect(hitsFor(patch, "bassline", 4).filter((step) => step >= 48)).toEqual([49, 52, 54, 56, 59, 61, 63]);
    expect(hitsFor(patch, "lead", 4)).toEqual([19, 27, 51, 59]);
    expect(patch.effects.distortion).toMatchObject({ enabled: true, mode: "soft" });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D", lowCut: 900 });
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.sends.bassline.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.bassline.reverb).toBe(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.kick).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
  });

  it("plays an ascending/descending C-minor-pentatonic line with paired accent and decay changes", () => {
    const patch = createPresetPatch("acid-basic");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead", bars: number) => hitsFor(patch, voice, bars).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline", 1)).toEqual(["C2", "F2", "G2", "B♭2", "B♭2", "G2", "F2", "C2"]);
    expect(notesFor("lead", 2)).toEqual(["E♭3", "G3"]);
    for (const step of [1, 5, 9, 13]) {
      expect(modulationAt("bassline", step).level).toBeGreaterThan(modulationAt("bassline", step + 2).level);
      expect(modulationAt("bassline", step).decay).toBeGreaterThan(modulationAt("bassline", step + 2).decay);
    }
    expect(modulationAt("ch", 1).level).toBeLessThan(modulationAt("ch", 0).level);
    const [groove, lift, breakdown] = createPresetArrangement("acid-basic").variations.map(({ patch }) => patch);
    expect(lift.voices.bassline.custom.cutoff).toBeGreaterThan(groove.voices.bassline.custom.cutoff);
    expect(lift.voices.bassline.custom.resonance).toBeGreaterThan(groove.voices.bassline.custom.resonance);
    expect(lift.voices.bassline.custom.filterDecay).toBeLessThan(groove.voices.bassline.custom.filterDecay);
    expect(breakdown.voices.bassline.custom.cutoff).toBeLessThan(groove.voices.bassline.custom.cutoff);
    expect(breakdown.voices.bassline.custom.filterDecay).toBeGreaterThan(groove.voices.bassline.custom.filterDecay);
  });

  it("densifies the lift, filters the kick break and releases the ending to a lead/rim response", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("acid-basic").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "clap", "ch"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "bassline", 4).filter((step) => step >= 48)).toEqual([48, 50, 51, 52, 54, 55, 56, 58, 59, 60, 62, 63]);
    expect(hitsFor(lift, "lead", 2)).toEqual([3, 23, 31]);
    expect(hitsFor(lift, "oh", 4)).toHaveLength(8);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual(Array.from({ length: 16 }, (_, index) => index * 2));
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 5, 9, 13, 17, 21, 25, 29]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([27]);
    expect(hitsFor(fill, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    expect(hitsFor(fill, "clap", 4)).toEqual(hitsFor(groove, "clap", 4));
    expect(hitsFor(fill, "bassline", 2)).toEqual(Array.from({ length: 14 }, (_, index) => 1 + index * 2));
    expect(hitsFor(fill, "lead", 2)).toEqual([29]);
    expect(hitsFor(fill, "rim", 4)).toEqual([31, 63]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 28 }, (_, index) => index));
    expect(hitsFor(fill, "oh", 2)).toEqual([6, 14, 22]);
    expect(hitsFor(fill, "bassline", 3)).toContain(47);
    expect(hitsFor(fill, "ch", 3)).toContain(47);
  });
});

describe("Acid with Tom Fill", () => {
  it("gives the two-bar tom answer space after a square 303 phrase and short 101 calls", () => {
    const patch = createPresetPatch("acid-tom-fill", 61);
    expect(patch).toMatchObject({ bpm: 122, rate: 4, swing: 0, vol: 61 });
    expect(hitsFor(patch, "bassline", 2)).toEqual([1, 4, 7, 9, 12, 15, 17, 20, 23]);
    expect(hitsFor(patch, "lead", 2)).toEqual([6, 18]);
    for (const id of ["kick", "clap", "ch", "ht", "mt", "lt"] as const) {
      expect(patch.voices[id].machine).toBe("909");
    }
    expect(patch.effects.distortion).toMatchObject({ enabled: true, mode: "soft" });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room", lowCut: 600 });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8" });
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const id of ["ht", "mt", "lt"] as const) {
      expect(patch.effects.sends[id].reverb).toBeGreaterThan(0);
      expect(patch.effects.sends[id].delay).toBe(0);
    }
    expect(patch.effects.sends.bassline.reverb).toBe(0);
    expect(patch.effects.sends.bassline.delay).toBe(0);
    expect(patch.effects.sends.kick).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
  });

  it("outlines G minor, answers on the fifth and softens the last note of each tom double", () => {
    const patch = createPresetPatch("acid-tom-fill");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["G2", "B♭2", "C3", "D3", "E♭3", "G3", "G2", "B♭2", "C3"]);
    expect(notesFor("lead")).toEqual(["G3", "D4"]);
    expect(modulationAt("bassline", 1).level).toBeGreaterThan(modulationAt("bassline", 7).level);
    expect(modulationAt("bassline", 1).decay).toBeGreaterThan(modulationAt("bassline", 7).decay);
    expect(modulationAt("ch", 1).level).toBeLessThan(modulationAt("ch", 0).level);
    for (const [voice, first] of [["mt", 28], ["lt", 30]] as const) {
      expect(modulationAt(voice, first + 1).level).toBeLessThan(modulationAt(voice, first).level);
      expect(modulationAt(voice, first + 1).decay).toBeLessThan(modulationAt(voice, first).decay);
    }
  });

  it("opens the lift, pares back the break and finishes the synth call before the closing roll", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("acid-tom-fill").variations.map(({ patch }) => patch);
    expect(hitsFor(lift, "bassline", 2)).toEqual(Array.from({ length: 12 }, (_, index) => 1 + index * 2));
    expect(hitsFor(lift, "lead", 2)).toEqual([6, 14, 18]);
    expect(lift.voices.bassline.custom.cutoff).toBeGreaterThan(groove.voices.bassline.custom.cutoff);
    expect(lift.voices.bassline.custom.filterDecay).toBeLessThan(groove.voices.bassline.custom.filterDecay);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 9, 17]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([6]);
    expect(breakdown.voices.bassline.custom.cutoff).toBeLessThan(groove.voices.bassline.custom.cutoff);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 4, 7, 9, 12, 15, 17]);
    expect(hitsFor(fill, "lead", 2)).toEqual([14]);
    expect(hitsFor(fill, "mt", 4)).toEqual([28, 29, 60, 61]);
    for (const patch of [groove, lift, breakdown, fill]) {
      for (const voice of ["bassline", "lead"] as const) {
        expect(hitsFor(patch, voice, 4).some((step) => step % 32 >= 24)).toBe(false);
      }
    }
  });
});

describe("Hypnotic Acid", () => {
  it("preserves the spare 909 groove while a twelve-step acid motif resolves every four bars", () => {
    const patch = createPresetPatch("hypnotic-acid", 62);
    expect(patch).toMatchObject({ bpm: 128, rate: 4, swing: 0, vol: 62 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitsFor(patch, "oh", 4)).toEqual([12, 28, 44, 60]);
    expect(hitsFor(patch, "rim", 1)).toEqual([3, 11]);
    expect(hitsFor(patch, "clap", 4)).toEqual([]);
    const phrase = [1, 4, 6, 9, 11, 13, 16, 18, 21, 23, 25, 28, 30, 33, 35, 37, 40, 42, 45, 47, 49, 52, 54, 57, 59];
    expect(hitsFor(patch, "bassline", 8)).toEqual([...phrase, ...phrase.map((step) => step + 64)]);
    expect(hitsFor(patch, "lead", 8)).toEqual([26, 90]);
    expect(hitsFor(patch, "shk", 4)).toEqual([]);
    for (const id of ["kick", "ch", "oh", "rim"] as const) expect(patch.voices[id].machine).toBe("909");
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D", lowCut: 800 });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio", lowCut: 900 });
    expect(patch.effects.distortion).toMatchObject({ enabled: true, mode: "soft" });
    for (const id of ["bassline", "rim", "lead"] as const) expect(patch.effects.sends[id].delay).toBeGreaterThan(0);
    expect(patch.effects.sends.bassline.reverb).toBe(0);
    for (const id of ["kick", "ch", "oh", "shk"] as const) {
      expect(patch.effects.sends[id]).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
    }
  });

  it("holds a root/fifth motif with changing note lengths and a sparse minor-third response", () => {
    const patch = createPresetPatch("hypnotic-acid");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 4).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(Array.from({ length: 5 }, () => ["F♯2", "F♯2", "C♯3", "F♯2", "C♯3"]).flat());
    expect(notesFor("lead")).toEqual(["A3"]);
    expect(modulationAt("bassline", 6).level).toBeGreaterThan(modulationAt("bassline", 4).level);
    expect(modulationAt("bassline", 6).decay).toBeGreaterThan(modulationAt("bassline", 4).decay);
    expect(modulationAt("ch", 2).level).toBeLessThan(modulationAt("ch", 0).level);
    expect(modulationAt("rim", 31).level).toBeLessThan(modulationAt("rim", 29).level);
  });

  it("adds a late lift, suspends the kick for the break and closes with an exposed rim pickup", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("hypnotic-acid").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "ch", "oh", "rim"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "bassline", 4).filter((step) => step >= 48)).toEqual([48, 49, 51, 53, 55, 56, 58]);
    expect(hitsFor(lift, "lead", 4)).toEqual([10, 26, 58]);
    expect(hitsFor(lift, "shk", 4)).toHaveLength(36);
    expect(lift.voices.bassline.custom.cutoff).toBeGreaterThan(groove.voices.bassline.custom.cutoff);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 5, 9, 13, 17, 21, 25]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([26]);
    expect(breakdown.voices.bassline.custom.cutoff).toBeLessThan(groove.voices.bassline.custom.cutoff);
    expect(breakdown.voices.bassline.custom.filterDecay).toBeGreaterThan(groove.voices.bassline.custom.filterDecay);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 4, 6, 9, 11, 13, 16, 18, 21, 23]);
    expect(hitsFor(fill, "lead", 2)).toEqual([29]);
    expect(hitsFor(fill, "rim", 2)).toEqual([3, 11, 19, 29, 31]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 14 }, (_, step) => step * 2));
    expect(hitsFor(fill, "oh", 2)).toEqual([12]);
    expect(hitsFor(fill, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    for (const voice of ["bassline", "lead", "rim", "ch", "oh"] as const) {
      const cycle = hitsFor(fill, voice, 2);
      expect(hitsFor(fill, voice, 4)).toEqual([...cycle, ...cycle.map((step) => step + 32)]);
    }
  });
});

describe("Detroit Syncopated Clap", () => {
  it("keeps the anticipated clap and 909 floor pulse beneath a two-bar melodic phrase", () => {
    const patch = createPresetPatch("detroit-syncopated-clap", 61);
    expect(patch).toMatchObject({ bpm: 130, rate: 4, swing: 0, vol: 61 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 12]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 7, 12, 20, 23, 28]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitsFor(patch, "oh", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "cym", 1)).toEqual(Array.from({ length: 16 }, (_, step) => step));
    expect(hitsFor(patch, "cym", 4).filter((step) => step >= 48)).toEqual([48, 50, 52, 54, 56, 58, 60, 62]);
    expect(hitsFor(patch, "bassline", 2)).toEqual([1, 7, 12, 19, 23, 27, 31]);
    expect(hitsFor(patch, "lead", 2)).toEqual([2, 8, 13, 22, 30]);
    for (const id of ["kick", "clap", "ch", "oh", "cym"] as const) expect(patch.voices[id].machine).toBe("909");
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room", lowCut: 700 });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8", lowCut: 900 });
    expect(patch.effects.compressor.enabled).toBe(true);
    expect(patch.effects.sends.clap.compressor).toBeGreaterThan(0);
    expect(patch.effects.sends.clap.reverb).toBeGreaterThan(0);
    expect(patch.effects.sends.clap.delay).toBe(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const id of ["bassline", "ch", "oh", "cym"] as const) {
      expect(patch.effects.sends[id]).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
    }
  });

  it("plays A Dorian with a softer, shorter ghost clap and restrained cymbal accents", () => {
    const patch = createPresetPatch("detroit-syncopated-clap");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["A2", "D3", "F♯3", "B2", "D3", "E3", "G3"]);
    expect(notesFor("lead")).toEqual(["B3", "D4", "G4", "E4", "B3"]);
    for (const step of [7, 23, 31]) {
      expect(modulationAt("clap", step).level).toBeLessThan(modulationAt("clap", 4).level);
      expect(modulationAt("clap", step).decay).toBeLessThan(modulationAt("clap", 4).decay);
    }
    expect(modulationAt("clap", 12)).toEqual(modulationAt("clap", 4));
    expect(modulationAt("ch", 2).level).toBeLessThan(modulationAt("ch", 0).level);
    expect(modulationAt("cym", 2).level).toBeGreaterThan(modulationAt("cym", 0).level);
    expect(patch.voices.cym.level).toBeLessThan(patch.voices.ch.level);
    expect(patch.voices.cym.decay).toBeLessThan(patch.voices.ch.decay);
  });

  it("lifts the melody, exposes the regular backbeat in C and ends with toms and a ghost clap", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("detroit-syncopated-clap").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "clap", "ch", "oh"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "bassline", 2)).toEqual([1, 5, 9, 13, 19, 23, 27, 31]);
    expect(hitsFor(lift, "lead", 2)).toEqual([2, 6, 10, 14, 18, 24, 29]);
    expect(hitsFor(lift, "cym", 4)).toHaveLength(64);
    expect(lift.voices.lead.custom.cutoff).toBeGreaterThan(groove.voices.lead.custom.cutoff);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "cym", 2)).toEqual([]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 9, 19, 27]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([2, 22]);
    expect(breakdown.voices.lead.custom.release).toBeGreaterThan(groove.voices.lead.custom.release);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 7, 12, 19, 23]);
    expect(hitsFor(fill, "lead", 2)).toEqual([2, 8, 13, 18]);
    expect(hitsFor(fill, "clap", 2)).toEqual([4, 7, 12, 20, 23, 28, 31]);
    expect(hitsFor(fill, "mt", 2)).toEqual([29]);
    expect(hitsFor(fill, "lt", 2)).toEqual([30]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 14 }, (_, step) => step * 2));
    expect(hitsFor(fill, "oh", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "cym", 2)).toEqual(Array.from({ length: 28 }, (_, step) => step));
    expect(hitsFor(fill, "kick", 4)).toEqual(hitsFor(groove, "kick", 4));
    for (const voice of ["bassline", "lead", "clap", "mt", "lt", "ch", "oh", "cym"] as const) {
      const cycle = hitsFor(fill, voice, 2);
      expect(hitsFor(fill, voice, 4)).toEqual([...cycle, ...cycle.map((step) => step + 32)]);
    }
  });
});

describe("Rolling Techno", () => {
  it("preserves the late kick and cymbal pickups beneath a rolling bass and second-bar reply", () => {
    const patch = createPresetPatch("rolling-techno", 60);
    expect(patch).toMatchObject({ bpm: 133, rate: 4, swing: 4, vol: 60 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 14]);
    expect(hitsFor(patch, "snare", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "cym", 1)).toEqual([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]);
    expect(hitsFor(patch, "oh", 2)).toEqual([10, 26]);
    expect(hitsFor(patch, "rim", 2)).toEqual([2, 13, 18, 29]);
    expect(hitsFor(patch, "ch", 4)).toEqual([]);
    expect(hitsFor(patch, "bassline", 4)).toEqual(Array.from({ length: 30 }, (_, step) => 1 + step * 2));
    expect(hitsFor(patch, "lead", 4)).toEqual([22, 30, 54, 62]);
    for (const id of ["kick", "snare", "cym", "oh", "rim"] as const) expect(patch.voices[id].machine).toBe("909");
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8T", lowCut: 1100 });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room", lowCut: 800 });
    expect(patch.effects.distortion).toMatchObject({ enabled: true, mode: "soft" });
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.sends.bassline.delay).toBe(0);
    expect(patch.effects.sends.bassline.reverb).toBe(0);
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.rim.delay).toBeGreaterThan(0);
    expect(patch.effects.sends.snare.delay).toBe(0);
    for (const id of ["kick", "cym", "ch", "oh"] as const) {
      expect(patch.effects.sends[id]).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
    }
  });

  it("rolls through D minor with accented roots/fifths and quieter cymbal pickups", () => {
    const patch = createPresetPatch("rolling-techno");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead", bars: number) => hitsFor(patch, voice, bars).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline", 1)).toEqual(["D2", "F2", "A2", "F2", "D2", "F2", "A2", "F2"]);
    expect(notesFor("lead", 2)).toEqual(["C4", "D3"]);
    for (const step of [1, 5, 9, 13]) {
      expect(modulationAt("bassline", step).level).toBeGreaterThan(modulationAt("bassline", step + 2).level);
      expect(modulationAt("bassline", step).decay).toBeGreaterThan(modulationAt("bassline", step + 2).decay);
    }
    expect(modulationAt("cym", 3).level).toBeLessThan(modulationAt("cym", 2).level);
    expect(modulationAt("snare", 31).level).toBeLessThan(modulationAt("snare", 28).level);
    expect(modulationAt("snare", 31).decay).toBeLessThan(modulationAt("snare", 28).decay);
    for (const { patch: variation } of createPresetArrangement("rolling-techno").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("fills out the lift, opens the break and clears the last beat for rim, kick and soft snare", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("rolling-techno").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "snare", "cym", "oh", "rim"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "bassline", 4)).toEqual(Array.from({ length: 32 }, (_, step) => 1 + step * 2));
    expect(hitsFor(lift, "lead", 2)).toEqual([6, 14, 22, 30]);
    expect(hitsFor(lift, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(lift.voices.bassline.custom.cutoff).toBeGreaterThan(groove.voices.bassline.custom.cutoff);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "cym", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "snare", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 5, 9, 13, 17, 21, 25, 29]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([30]);
    expect(breakdown.voices.lead.custom.release).toBeGreaterThan(groove.voices.lead.custom.release);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 4, 8, 14, 16, 20, 24, 30]);
    expect(hitsFor(fill, "rim", 2)).toEqual([2, 13, 18, 29]);
    expect(hitsFor(fill, "snare", 2)).toEqual([4, 12, 20, 28, 31]);
    expect(hitsFor(fill, "bassline", 2)).toEqual(Array.from({ length: 14 }, (_, step) => 1 + step * 2));
    expect(hitsFor(fill, "lead", 2)).toEqual([6]);
    expect(hitsFor(fill, "cym", 2)).toEqual([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27]);
    for (const voice of ["bassline", "lead", "snare", "cym"] as const) {
      const cycle = hitsFor(fill, voice, 2);
      expect(hitsFor(fill, voice, 4)).toEqual([...cycle, ...cycle.map((step) => step + 32)]);
    }
    expect(hitsFor(groove, "bassline", 8).slice(30)).toEqual(hitsFor(groove, "bassline", 4).map((step) => step + 64));
  });
});

describe("Tom-Driven Techno", () => {
  it("keeps the interlocking 909 tom groove ahead of a low bass pulse and sparse 101 reply", () => {
    const patch = createPresetPatch("tom-driven-techno", 63);
    expect(patch).toMatchObject({ bpm: 132, rate: 4, swing: 0, vol: 63 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 12]);
    expect(hitsFor(patch, "clap", 2)).toEqual([8, 24]);
    expect(hitsFor(patch, "lt", 2)).toEqual([2, 10, 18, 26]);
    expect(hitsFor(patch, "mt", 2)).toEqual([6, 14, 22, 30]);
    expect(hitsFor(patch, "ht", 2)).toEqual([3, 11, 19, 27]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 57]);
    expect(hitsFor(patch, "lead", 4)).toEqual([7, 31, 39, 63]);
    expect(hitsFor(patch, "shk", 4)).toEqual([]);
    for (const id of ["kick", "clap", "lt", "mt", "ht", "ch"] as const) expect(patch.voices[id].machine).toBe("909");
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room", lowCut: 650 });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D", lowCut: 1100 });
    expect(patch.effects.compressor.enabled).toBe(true);
    for (const id of ["lt", "mt", "ht"] as const) {
      expect(patch.effects.sends[id].compressor).toBeGreaterThan(0);
      expect(patch.effects.sends[id].reverb).toBeGreaterThan(0);
      expect(patch.effects.sends[id].delay).toBe(0);
    }
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const id of ["kick", "bassline", "ch", "shk"] as const) {
      expect(patch.effects.sends[id]).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
    }
  });

  it("supports F-sharp minor while shaping the tom pairs and the final low-tom release", () => {
    const [patch, , , fill] = createPresetArrangement("tom-driven-techno").variations.map(({ patch }) => patch);
    const modulationAt = (patch: Patch, voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 2).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(patch, voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["F♯1", "F♯1", "F♯1", "F♯1", "C♯2", "C♯2", "C♯2", "C♯2"]);
    expect(notesFor("lead")).toEqual(["A3", "F♯3"]);
    for (const [voice, step] of [["lt", 2], ["mt", 6], ["ht", 3]] as const) {
      expect(modulationAt(patch, voice, step).level).toBeGreaterThan(modulationAt(patch, voice, step + 8).level);
      expect(modulationAt(patch, voice, step).decay).toBeGreaterThan(modulationAt(patch, voice, step + 8).decay);
    }
    expect(modulationAt(fill, "lt", 31).level).toBeLessThan(modulationAt(fill, "lt", 30).level);
    expect(modulationAt(fill, "lt", 31).decay).toBeLessThan(modulationAt(fill, "lt", 30).decay);
    expect(modulationAt(patch, "ch", 2).level).toBeLessThan(modulationAt(patch, "ch", 0).level);
    for (const { patch: variation } of createPresetArrangement("tom-driven-techno").variations) {
      const drums = new Set(["kick", "lt", "mt", "ht"].flatMap((voice) => hitsFor(variation, voice as VoiceId, 4)));
      expect(hitsFor(variation, "bassline", 4).some((step) => drums.has(step))).toBe(false);
    }
  });

  it("adds a high-tom lift, opens a low/mid-tom break and ends with a descending roll", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("tom-driven-techno").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "clap", "lt", "mt", "ch"] as const) {
      expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    }
    expect(hitsFor(lift, "ht", 4).filter((step) => step >= 48)).toEqual([51, 55, 59, 63]);
    expect(hitsFor(lift, "shk", 2)).toEqual(Array.from({ length: 16 }, (_, step) => 1 + step * 2));
    expect(hitsFor(lift, "bassline", 4)).toEqual(Array.from({ length: 16 }, (_, step) => 1 + step * 4));
    expect(hitsFor(lift, "lead", 2)).toEqual([7, 15, 23, 31]);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([0, 8, 16, 24]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([]);
    expect(hitsFor(breakdown, "ht", 2)).toEqual([]);
    expect(hitsFor(breakdown, "lt", 2)).toEqual(hitsFor(groove, "lt", 2));
    expect(hitsFor(breakdown, "mt", 2)).toEqual(hitsFor(groove, "mt", 2));
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([1, 9, 17, 25]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([31]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 14 }, (_, step) => step * 2));
    expect(hitsFor(fill, "ht", 2)).toEqual([3, 11, 19, 28]);
    expect(hitsFor(fill, "mt", 2)).toEqual([6, 14, 22, 29]);
    expect(hitsFor(fill, "lt", 2)).toEqual([2, 10, 18, 30, 31]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([1, 5, 9, 13, 17, 21]);
    expect(hitsFor(fill, "lead", 2)).toEqual([7]);
    for (const voice of ["kick", "ch", "ht", "mt", "lt", "bassline", "lead"] as const) {
      const cycle = hitsFor(fill, voice, 2);
      expect(hitsFor(fill, voice, 4)).toEqual([...cycle, ...cycle.map((step) => step + 32)]);
    }
  });
});

describe("Minimal / Dub Techno", () => {
  it("preserves the sparse 909 pulse with a four-bar bass phrase and widely spaced stabs", () => {
    const patch = createPresetPatch("minimal-dub-techno", 62);
    expect(patch).toMatchObject({ bpm: 125, rate: 4, swing: 0, vol: 62 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "rim", 4)).toEqual([10, 26, 42, 58]);
    expect(hitsFor(patch, "oh", 4)).toEqual([14, 30, 46]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([3, 11, 19, 27, 35, 43, 51]);
    expect(hitsFor(patch, "lead", 8)).toEqual([5, 51, 69, 115]);
    for (const id of ["kick", "ch", "rim", "oh"] as const) expect(patch.voices[id].machine).toBe("909");
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8D", lowCut: 800 });
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "studio", lowCut: 900 });
    for (const id of ["rim", "lead"] as const) {
      expect(patch.effects.sends[id].delay).toBeGreaterThan(0);
      expect(patch.effects.sends[id].reverb).toBeGreaterThan(0);
    }
    for (const id of ["kick", "bassline", "ch", "oh"] as const) {
      expect(patch.effects.sends[id]).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
    }
    for (const id of ["distortion", "compressor", "karplus"] as const) expect(patch.effects[id].enabled).toBe(false);
  });

  it("colours the B-minor foundation with a third and seventh while alternating hat and phrase accents", () => {
    const patch = createPresetPatch("minimal-dub-techno");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead") => hitsFor(patch, voice, 4).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline")).toEqual(["B1", "B1", "F♯2", "F♯2", "B1", "B1", "F♯2"]);
    expect(notesFor("lead")).toEqual(["D4", "A4"]);
    expect(modulationAt("ch", 6).level).toBeLessThan(modulationAt("ch", 2).level);
    expect(modulationAt("ch", 14).level).toBeLessThan(modulationAt("ch", 10).level);
    expect(modulationAt("rim", 26).level).toBeLessThan(modulationAt("rim", 10).level);
    expect(modulationAt("rim", 26).decay).toBeLessThan(modulationAt("rim", 10).decay);
    expect(modulationAt("lead", 51).decay).toBeLessThan(modulationAt("lead", 5).decay);
    for (const { patch: variation } of createPresetArrangement("minimal-dub-techno").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("lifts gently, exposes the echo in C and lets the final bar dissolve before returning", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("minimal-dub-techno").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "ch"] as const) expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    expect(hitsFor(lift, "bassline", 4)).toEqual([3, 11, 19, 27, 35, 43, 51, 59]);
    expect(hitsFor(lift, "lead", 4)).toEqual([5, 21, 35, 51]);
    expect(hitsFor(lift, "rim", 4)).toEqual([10, 26, 42, 50, 58]);
    expect(hitsFor(lift, "oh", 4)).toEqual([14, 30, 46, 54, 62]);
    expect(lift.voices.lead.custom.cutoff).toBeGreaterThan(groove.voices.lead.custom.cutoff);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([2, 10, 18, 26]);
    expect(hitsFor(breakdown, "rim", 2)).toEqual([10, 26]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([3]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([5]);
    expect(breakdown.effects.delay.feedback).toBeGreaterThan(groove.effects.delay.feedback);
    expect(breakdown.effects.delay.tone).toBeLessThan(groove.effects.delay.tone);
    expect(breakdown.voices.lead.custom.release).toBeGreaterThan(groove.voices.lead.custom.release);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(hitsFor(fill, "ch", 2)).toEqual([2, 6, 10, 14, 18, 22]);
    expect(hitsFor(fill, "rim", 2)).toEqual([10, 23]);
    expect(hitsFor(fill, "oh", 2)).toEqual([14]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([3, 11, 19]);
    expect(hitsFor(fill, "lead", 2)).toEqual([5]);
    for (const voice of ["kick", "ch", "rim", "oh", "bassline", "lead"] as const) {
      const cycle = hitsFor(fill, voice, 2);
      expect(cycle.some((step) => step > 24)).toBe(false);
      expect(hitsFor(fill, voice, 4)).toEqual([...cycle, ...cycle.map((step) => step + 32)]);
    }
  });
});

describe("Rave Stomp", () => {
  it("keeps the 909 floor pulse and offbeat hats with a phrase crash and an E-minor hook", () => {
    const patch = createPresetPatch("rave-stomp", 61);
    expect(patch).toMatchObject({ bpm: 140, rate: 4, swing: 0, vol: 61 });
    expect(hitsFor(patch, "kick", 1)).toEqual([0, 4, 8, 12]);
    expect(hitsFor(patch, "ch", 1)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitsFor(patch, "oh", 1)).toEqual([2, 6, 10, 14]);
    expect(hitsFor(patch, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(patch, "cym", 8)).toEqual([0, 64]);
    expect(hitsFor(patch, "bassline", 4)).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 58]);
    expect(hitsFor(patch, "lead", 4)).toEqual([3, 11, 23, 35, 43, 55]);
    expect(hitsFor(patch, "snare", 4)).toEqual([]);
    expect(hitsFor(patch, "shk", 4)).toEqual([]);
    for (const id of ["kick", "ch", "oh", "clap", "cym"] as const) expect(patch.voices[id].machine).toBe("909");
    expect(patch.effects.distortion).toMatchObject({ enabled: true, mode: "hard", trim: -3 });
    expect(patch.effects.sends.kick.distortion).toBeGreaterThan(0);
    expect(patch.effects.sends.bassline.distortion).toBeGreaterThan(0);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, space: "room", lowCut: 900 });
    expect(patch.effects.delay).toMatchObject({ enabled: true, sync: true, division: "1/8", lowCut: 1200 });
    expect(patch.effects.sends.lead.delay).toBeGreaterThan(0);
    for (const id of ["kick", "bassline"] as const) {
      expect(patch.effects.sends[id].reverb).toBe(0);
      expect(patch.effects.sends[id].delay).toBe(0);
    }
    for (const id of ["ch", "oh", "cym", "shk"] as const) {
      expect(patch.effects.sends[id]).toEqual({ distortion: 0, delay: 0, reverb: 0, compressor: 0, karplus: 0 });
    }
  });

  it("arpeggiates E minor under an E/B hook and gives the closing roll alternating accents", () => {
    const patch = createPresetPatch("rave-stomp");
    const modulationAt = (voice: VoiceId, step: number) => effectiveVoiceModulation(patch.voices[voice], (source) => {
      const block = patch.blocks[source];
      return euclideanLfoValue(block.shape, step, block, 0.5);
    });
    const notesFor = (voice: "bassline" | "lead", bars: number) => hitsFor(patch, voice, bars).map((step) => quantizeVoiceCv(patch.voices[voice].custom, modulationAt(voice, step).vOct).name);
    expect(notesFor("bassline", 1)).toEqual(["E2", "G2", "B2", "G2"]);
    expect(notesFor("lead", 2)).toEqual(["E4", "B4", "E4"]);
    expect(modulationAt("ch", 2).level).toBeLessThan(modulationAt("ch", 0).level);
    expect(modulationAt("shk", 3).level).toBeLessThan(modulationAt("shk", 1).level);
    for (const step of [28, 30]) {
      expect(modulationAt("snare", step + 1).level).toBeLessThan(modulationAt("snare", step).level);
      expect(modulationAt("snare", step + 1).decay).toBeLessThan(modulationAt("snare", step).decay);
    }
    for (const { patch: variation } of createPresetArrangement("rave-stomp").variations) {
      const kicks = new Set(hitsFor(variation, "kick", 4));
      expect(hitsFor(variation, "bassline", 4).some((step) => kicks.has(step))).toBe(false);
    }
  });

  it("lifts the hook, filters the kick break and accelerates the final snare roll into the return", () => {
    const [groove, lift, breakdown, fill] = createPresetArrangement("rave-stomp").variations.map(({ patch }) => patch);
    for (const voice of ["kick", "ch", "oh", "clap"] as const) expect(hitsFor(lift, voice, 4)).toEqual(hitsFor(groove, voice, 4));
    expect(hitsFor(lift, "cym", 4)).toEqual([0, 32]);
    expect(hitsFor(lift, "bassline", 4)).toEqual(Array.from({ length: 16 }, (_, step) => 2 + step * 4));
    expect(hitsFor(lift, "lead", 2)).toEqual([3, 7, 11, 15, 23, 31]);
    expect(hitsFor(lift, "shk", 2)).toEqual(Array.from({ length: 16 }, (_, step) => 1 + step * 2));
    expect(lift.voices.bassline.custom.cutoff).toBeGreaterThan(groove.voices.bassline.custom.cutoff);
    expect(hitsFor(breakdown, "kick", 2)).toEqual([]);
    expect(hitsFor(breakdown, "oh", 2)).toEqual([]);
    expect(hitsFor(breakdown, "cym", 2)).toEqual([]);
    expect(hitsFor(breakdown, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(breakdown, "ch", 2)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(hitsFor(breakdown, "bassline", 2)).toEqual([2, 10, 18, 26]);
    expect(hitsFor(breakdown, "lead", 2)).toEqual([11, 19]);
    expect(breakdown.voices.lead.custom.release).toBeGreaterThan(groove.voices.lead.custom.release);
    expect(breakdown.effects.sends.bassline.distortion).toBeLessThan(groove.effects.sends.bassline.distortion);
    expect(hitsFor(fill, "snare", 2)).toEqual([16, 20, 24, 26, 28, 29, 30, 31]);
    expect(hitsFor(fill, "kick", 2)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(hitsFor(fill, "bassline", 2)).toEqual([2, 6, 10, 14, 18, 22]);
    expect(hitsFor(fill, "lead", 2)).toEqual([3, 11]);
    expect(hitsFor(fill, "ch", 2)).toEqual(Array.from({ length: 14 }, (_, step) => step * 2));
    expect(hitsFor(fill, "oh", 2)).toEqual([2, 6, 10, 14, 18, 22, 26]);
    expect(hitsFor(fill, "clap", 2)).toEqual([4, 12, 20, 28]);
    expect(hitsFor(fill, "cym", 4)).toEqual([0, 32]);
    for (const voice of ["kick", "bassline", "lead", "snare", "ch", "oh"] as const) {
      const cycle = hitsFor(fill, voice, 2);
      expect(hitsFor(fill, voice, 4)).toEqual([...cycle, ...cycle.map((step) => step + 32)]);
    }
  });
});

describe.each(["electro-backbeat", "electro-funk-maracas", "stripped-808-breakbeat", "bass-tempo-standard", "double-time-bass", "half-time-bass-groove", "boom-bap", "sparse-808-ballad", "modern-808-hip-hop", "trap-standard", "triplet-trap", "drill-variant", "basic-house", "open-hat-house", "deep-house-shuffle", "jackin-house", "acid-basic", "acid-tom-fill", "hypnotic-acid", "detroit-syncopated-clap", "rolling-techno", "tom-driven-techno", "minimal-dub-techno", "rave-stomp"])("%s persistence", (id) => {
  it("round-trips every variation and keeps series, routes and sends independently editable", () => {
    const arrangement = createPresetArrangement(id);
    for (const { patch } of arrangement.variations) {
      const exported = JSON.stringify(patch);
      const restored = normalizePatch(JSON.parse(exported))!;
      expect(restored.blocks).toEqual(patch.blocks);
      expect(restored.effects).toEqual(patch.effects);
      expect(restored.voices.bassline).toEqual(patch.voices.bassline);
      expect(restored.voices.lead).toEqual(patch.voices.lead);
      expect(restored.voices.shk.modulations).toEqual(patch.voices.shk.modulations);
      expect(restored.voices.snare.modulations).toEqual(patch.voices.snare.modulations);
      expect(restored.voices.clap.modulations).toEqual(patch.voices.clap.modulations);
      expect(restored.voices.cow.modulations).toEqual(patch.voices.cow.modulations);
      expect(restored.voices.ch.modulations).toEqual(patch.voices.ch.modulations);
      expect(restored.voices.oh.modulations).toEqual(patch.voices.oh.modulations);
      expect(restored.voices.lt.modulations).toEqual(patch.voices.lt.modulations);
      expect(restored.voices.mt.modulations).toEqual(patch.voices.mt.modulations);
      expect(restored.voices.ht.modulations).toEqual(patch.voices.ht.modulations);
      expect(restored.voices.cym.modulations).toEqual(patch.voices.cym.modulations);
      for (const voice of Object.values(patch.voices)) {
        for (const route of voice.modulations) {
          expect(patch.blocks[Number(route.source)]).toMatchObject({ kind: "modulator", mute: false });
          expect(patch.blocks[Number(route.source)].pulses).toBeGreaterThan(0);
        }
      }
      for (const block of patch.blocks) {
        for (const rhythm of rhythmsFor(block)) {
          expect(rhythm.pulses).toBeLessThanOrEqual(rhythm.steps);
        }
      }
    }
    const original = JSON.stringify(arrangement.variations[0].patch);
    const lift = arrangement.variations[1].patch;
    lift.blocks.find((block) => block.series.length)!.series[0].pulses = 0;
    lift.voices.bassline.modulations[0].amount = 0;
    lift.effects.sends.lead.delay = 0;
    expect(JSON.stringify(arrangement.variations[0].patch)).toBe(original);
    expect(createPresetArrangement(id).variations[0].patch).toEqual(JSON.parse(original));
  });
});
