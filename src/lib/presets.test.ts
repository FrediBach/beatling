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

describe.each(["electro-backbeat", "electro-funk-maracas", "stripped-808-breakbeat", "bass-tempo-standard", "double-time-bass", "half-time-bass-groove", "boom-bap", "sparse-808-ballad", "modern-808-hip-hop", "trap-standard", "triplet-trap", "drill-variant"])("%s persistence", (id) => {
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
      expect(restored.voices.ch.modulations).toEqual(patch.voices.ch.modulations);
      expect(restored.voices.lt.modulations).toEqual(patch.voices.lt.modulations);
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
