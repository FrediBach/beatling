import { describe, expect, it } from "vitest";
import { euclidHit } from "@/lib/euclid";
import { normalizePatch } from "@/lib/patch";
import { createPresetArrangement, createPresetPatch } from "@/lib/presets";
import { rhythmsFor } from "@/lib/rhythm-series";
import { euclideanLfoValue } from "@/lib/lfo";
import { effectiveVoiceModulation } from "@/lib/modulation";
import { quantizeVoiceCv } from "@/lib/quantizer";
import type { Patch, VoiceId } from "@/lib/types";

// Expand the authored series into global sixteenth-note positions. These presets
// use the global clock at division 1, without chance or routed mute inputs.
function hitsFor(patch: Patch, voice: VoiceId, bars: number): number[] {
  const hits = new Set<number>();
  for (const block of patch.blocks) {
    if (block.voice !== voice || block.mute || patch.voices[voice].mute) continue;
    const cycle = rhythmsFor(block).flatMap((rhythm) => Array.from({ length: rhythm.repeats * rhythm.steps }, (_, step) =>
      euclidHit(step % rhythm.steps, rhythm.steps, rhythm.pulses, rhythm.rot)));
    for (let step = 0; step < bars * 16; step++) {
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

describe.each(["electro-backbeat", "electro-funk-maracas", "stripped-808-breakbeat", "bass-tempo-standard", "double-time-bass"])("%s persistence", (id) => {
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
