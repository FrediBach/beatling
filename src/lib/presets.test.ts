import { describe, expect, it } from "vitest";
import { euclidHit } from "@/lib/euclid";
import { normalizePatch } from "@/lib/patch";
import { createPresetArrangement, createPresetPatch } from "@/lib/presets";
import { rhythmsFor } from "@/lib/rhythm-series";
import { euclideanLfoValue } from "@/lib/lfo";
import { effectiveVoiceModulation } from "@/lib/modulation";
import type { Patch, VoiceId } from "@/lib/types";

// Expand the authored series into global sixteenth-note positions. These presets
// uses the global clock at division 1, without chance or routed mute inputs.
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

describe.each(["electro-backbeat", "electro-funk-maracas"])("%s persistence", (id) => {
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
