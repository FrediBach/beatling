import { describe, expect, it } from "vitest";
import { createDemoPatch, createEmptyPatch, createRandomizationLocks, normalizePatch, randomizeBlockParameter, shufflePatch } from "@/lib/patch";
import { createPresetArrangement, createPresetPatch, DRUM_PRESETS } from "@/lib/presets";
import { euclidHit } from "@/lib/euclid";
import { variationHasChanges } from "@/lib/variations";
import type { SequencerBlock } from "@/lib/types";

describe("patches", () => {
  it("creates the complete 16-block demo", () => {
    const patch = createDemoPatch();
    expect(patch.blocks).toHaveLength(16);
    expect(patch.blocks[0]).toMatchObject({ voice: "kick", steps: 16, pulses: 4 });
    expect(patch.blocks[2]).toMatchObject({ modulations: [{ source: "12", destination: "prob", amount: -0.5 }] });
    expect(patch.blocks[7]).toMatchObject({ voice: "bassline", steps: 16, pulses: 7, rot: 1 });
    expect(patch.blocks[8]).toMatchObject({ voice: "lead", steps: 16, pulses: 6, rot: 1, div: 1, prob: 100 });
    expect(patch.voices.kick.machine).toBe("909");
    expect(patch.voices.clap.machine).toBe("808");
    expect(patch.voices.kick.custom.bodyFrequency).toBe(50);
    expect(Object.keys(patch.voices)).toHaveLength(14);
    expect(patch.voices.bassline).toMatchObject({ machine: "custom", custom: { root: 0, scale: 2, octave: 2 } });
    expect(patch.voices.lead).toMatchObject({ machine: "custom", custom: { root: 0, scale: 1, octave: 4 } });
    expect(patch.voices.bassline.modulations).toEqual([{ source: "12", destination: "vOct", amount: 1 }]);
    expect(patch.voices.lead.modulations).toEqual([{ source: "13", destination: "vOct", amount: 1 }]);
    expect(patch.voices.lead.level).toBe(42);
    expect(patch.effects.reverb).toMatchObject({ enabled: true, damping: 7000, return: 95 });
    expect(patch.effects.sends.lead.reverb).toBe(78);
    expect(patch.blocks[12]).toMatchObject({ kind: "modulator", voice: "" });
  });

  it("migrates old voices and clamps imported custom synthesis settings", () => {
    const source = createEmptyPatch() as unknown as { voices: Record<string, Record<string, unknown>> };
    delete source.voices.snare.custom;
    source.voices.kick.machine = "custom";
    source.voices.kick.custom = { bodyFrequency: 500, pitchAmount: 7 };

    const patch = normalizePatch(source)!;
    expect(patch.voices.snare.custom.toneFrequency).toBe(185);
    expect(patch.voices.kick.machine).toBe("custom");
    expect(patch.voices.kick.custom.bodyFrequency).toBe(100);
    expect(patch.voices.kick.custom.pitchAmount).toBe(7);
    expect(patch.voices.kick.custom.clickFrequency).toBe(1800);
  });

  it("normalizes quantized V/Oct only for synth voices", () => {
    const source = createEmptyPatch();
    source.voices.kick.modulations = [{ source: "12", destination: "vOct", amount: 1 }];
    source.voices.bassline.modulations = [{ source: "12", destination: "vOct", amount: 2 }];
    source.voices.bassline.machine = "808";
    source.voices.bassline.custom = { ...source.voices.bassline.custom, root: 99, scale: 99, octave: -5 };
    const patch = normalizePatch(source)!;
    expect(patch.voices.kick.modulations).toEqual([]);
    expect(patch.voices.bassline).toMatchObject({ machine: "custom", modulations: [{ source: "12", destination: "vOct", amount: 1 }], custom: { root: 11, scale: 5, octave: 1 } });
  });

  it("migrates v1 patches to silent effect sends and clamps imported effect settings", () => {
    const legacy = createEmptyPatch() as unknown as Record<string, unknown>;
    legacy.format = "euclid-grid.v1";
    delete legacy.effects;
    const migrated = normalizePatch(legacy)!;
    expect(migrated.format).toBe("euclid-grid.v9");
    expect(migrated.effects.distortion.enabled).toBe(false);
    expect(migrated.effects.sends.kick.reverb).toBe(0);
    expect(migrated.effects.karplus).toMatchObject({ enabled: false, model: "string", tune: 48, body: 60, decay: 65 });
    expect(migrated.effects.sends.kick.karplus).toBe(0);

    const imported = normalizePatch({
      ...createEmptyPatch(),
      effects: {
        distortion: { enabled: true, drive: 200, tone: 5, return: 120 },
        delay: { enabled: true, time: 9000, feedback: 99 },
        karplus: { enabled: true, model: "invalid", tune: -30, body: 300, decay: 88, return: 101 },
        sends: { kick: { distortion: 140, delay: -20, karplus: 64 } },
      },
    })!;
    expect(imported.effects.distortion).toMatchObject({ enabled: true, drive: 100, tone: 400, return: 100 });
    expect(imported.effects.delay).toMatchObject({ enabled: true, time: 2000, feedback: 85 });
    expect(imported.effects.karplus).toMatchObject({ enabled: true, model: "string", tune: 0, body: 100, decay: 88, return: 100 });
    expect(imported.effects.sends.kick).toMatchObject({ distortion: 100, delay: 0, reverb: 0, karplus: 64, compressor: 0 });
  });

  it("migrates block kinds and normalizes Bernoulli voice branches", () => {
    const legacyVoice = { ...createEmptyPatch().blocks[0] } as Partial<SequencerBlock> & Record<string, unknown>;
    delete legacyVoice.kind;
    delete legacyVoice.branchVoices;
    const legacyModulator = { ...legacyVoice, voice: "" };
    const patch = normalizePatch({
      blocks: [
        legacyVoice,
        legacyModulator,
        { ...legacyModulator, kind: "bernoulli", branchVoices: ["kick", "kick"] },
      ],
    })!;
    expect(patch.blocks[0]).toMatchObject({ kind: "voice", voice: "kick", branchVoices: ["kick", "snare"] });
    expect(patch.blocks[1]).toMatchObject({ kind: "modulator", voice: "" });
    expect(patch.blocks[2]).toMatchObject({ kind: "bernoulli", voice: "", branchVoices: ["kick", "snare"] });
  });

  it("keeps routing when patterns are shuffled", () => {
    const patch = createDemoPatch();
    const shuffled = shufflePatch(patch, () => 0.5);
    expect(shuffled.blocks[9].clk).toEqual(["G", "1"]);
    expect(shuffled.blocks[0]).toMatchObject({ steps: 16, pulses: 4, rot: 0 });
  });

  it("keeps locked settings unchanged while shuffling the rest", () => {
    const patch = createDemoPatch();
    const locks = createRandomizationLocks();
    locks[1].steps = true;
    locks[1].prob = true;
    const shuffled = shufflePatch(patch, () => 0, locks);
    expect(shuffled.blocks[1]).toMatchObject({ steps: 16, prob: 100, pulses: 0, rot: 0, div: 1 });
    expect(shuffled.blocks[1].clk).toEqual(patch.blocks[1].clk);
  });

  it("randomizes one setting without changing its neighbours", () => {
    const block = createDemoPatch().blocks[2];
    const randomized = randomizeBlockParameter(block, 2, "prob", () => 0);
    expect(randomized).toMatchObject({ steps: block.steps, pulses: block.pulses, rot: block.rot, div: block.div, prob: 40 });
  });

  it("normalizes partial imported patches without sharing defaults", () => {
    const normalized = normalizePatch({ blocks: [{ pulses: 7, clk: ["0"] }], bpm: 999 });
    expect(normalized?.bpm).toBe(300);
    expect(normalized?.blocks).toHaveLength(16);
    expect(normalized?.blocks[0].pulses).toBe(7);
    expect(normalized?.blocks[1]).toEqual(createEmptyPatch().blocks[1]);
  });

  it("migrates and bounds per-block rhythm series", () => {
    const patch = normalizePatch({
      blocks: [{ steps: 8, pulses: 3, rot: 2, repeats: 99, series: [
        { steps: 12, pulses: 5, rot: 4, repeats: 2 },
        { steps: 0, pulses: 99, rot: 99, repeats: 0 },
      ] }],
    })!;
    expect(patch.blocks[0]).toMatchObject({ steps: 8, pulses: 3, rot: 2, repeats: 16 });
    expect(patch.blocks[0].series).toEqual([
      { id: "block-1-rhythm-2", steps: 12, pulses: 5, rot: 4, repeats: 2 },
      { id: "block-1-rhythm-3", steps: 8, pulses: 8, rot: 7, repeats: 1 },
    ]);
    expect(patch.blocks[1]).toMatchObject({ repeats: 1, series: [] });
  });

  it("builds every documented drum preset within the 16-block system", () => {
    expect(DRUM_PRESETS).toHaveLength(40);
    for (const preset of DRUM_PRESETS) {
      const patch = createPresetPatch(preset.id);
      expect(patch.blocks).toHaveLength(16);
      expect(patch.bpm).toBe(preset.bpm);
      expect(patch.blocks.some((block) => block.pulses > 0)).toBe(true);
      if (preset.id === "acid-tom-fill") continue;
      for (const lane of preset.lanes) {
        const steps = lane.steps ?? 16;
        const actual = Array.from({ length: steps }, (_, step) => patch.blocks.some((block) => block.voice === lane.voice && block.steps === steps && euclidHit(step, block.steps, block.pulses, block.rot)));
        const expected = Array.from({ length: steps }, (_, step) => lane.hits.includes(step));
        expect(actual, `${preset.id}: ${lane.voice}`).toEqual(expected);
      }
    }
  });

  it("turns every existing preset into an arranged four-part song", () => {
    expect(DRUM_PRESETS).toHaveLength(40);
    for (const preset of DRUM_PRESETS) {
      const arrangement = createPresetArrangement(preset.id);
      expect(arrangement.songMode, preset.id).toBe(true);
      expect(arrangement.activeIndex).toBe(0);
      expect(arrangement.variations.map((variation) => variation.name)).toEqual(["A", "B", "C", "D"]);
      expect(arrangement.songParts.map((part) => part.bars)).toEqual([4, 4, 2, 2]);
      expect(arrangement.songParts.map((part) => part.variationId)).toEqual(arrangement.variations.map((variation) => variation.id));
      expect(arrangement.variations.every((variation) => variation.patch.blocks.length === 16)).toBe(true);
      for (const variation of arrangement.variations.slice(1)) {
        expect(variationHasChanges(variation, arrangement.variations[0]), `${preset.id}: ${variation.name}`).toBe(true);
      }
    }
  });

  it("keeps four-hit endings for presets with generated fill variations", () => {
    for (const id of ["machine-breakbeat", "big-beat", "jungle-half-time"]) {
      const patch = createPresetArrangement(id).variations[3].patch;
      const endingHits = Array.from({ length: 4 }, (_, offset) => patch.blocks.some((block) => ["snare", "rim", "clap"].includes(block.voice) && euclidHit(patch.rate * 4 - 4 + offset, block.steps, block.pulses, block.rot)));
      expect(endingHits, id).toEqual([true, true, true, true]);
    }
  });

  it("builds the two-bar acid fill with Euclidean mute gates", () => {
    const patch = createPresetPatch("acid-tom-fill");
    expect(patch.blocks[0]).toMatchObject({ voice: "", steps: 32, pulses: 1, gate: 100 });
    expect(patch.blocks[1]).toMatchObject({ voice: "", steps: 32, pulses: 1, gate: 800 });
    expect(patch.blocks[2]).toMatchObject({ voice: "kick", steps: 16, pulses: 4, mut: "0" });
    expect(patch.blocks[4]).toMatchObject({ voice: "ch", steps: 16, pulses: 16, mut: "1" });
    expect(patch.blocks.filter((block) => ["lt", "mt", "ht"].includes(block.voice) && block.steps === 32)).toHaveLength(5);
  });

  it("recreates the electro backbeat with layered Euclidean blocks", () => {
    const patch = createPresetPatch("electro-backbeat");
    const hitsFor = (voice: string) => Array.from({ length: 16 }, (_, step) => patch.blocks.some((block) => block.voice === voice && euclidHit(step, block.steps, block.pulses, block.rot)));
    expect(hitsFor("kick")).toEqual([true, false, false, false, false, false, true, false, true, false, false, false, false, false, true, false]);
    expect(hitsFor("cow")).toEqual([false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false]);
  });
});
