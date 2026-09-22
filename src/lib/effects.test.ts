import { afterEach, describe, expect, it } from "vitest";
import { compressedDb, createEffects, delaySeconds, distortionSample, normalizeEffects, waveguideFeedback } from "./effects";
import { createEmptyPatch, loadStoredPatch, normalizePatch } from "./patch";
import { createArrangement, loadStoredArrangement, saveArrangement } from "./variations";

afterEach(() => localStorage.clear());

describe("expanded effect settings", () => {
  it("migrates v8 storage without reinterpreting existing settings or sends", () => {
    const legacy = { ...createEmptyPatch(), format: "euclid-grid.v8", effects: {
      distortion: { enabled: true, drive: 63, tone: 4500, return: 50 },
      reverb: { enabled: true, damping: 3000, return: 48 },
      delay: { enabled: true, time: 375, feedback: 70, tone: 2000, return: 24 },
      karplus: { enabled: true, model: "tube", tune: 76, body: 44, decay: 90, return: 20 },
      compressor: { enabled: true, threshold: -30, ratio: 8, attack: 4, release: 300, return: 70 },
      sends: { kick: { distortion: 40, karplus: 30 } },
    } };
    localStorage.setItem("egs.patch.v8", JSON.stringify(legacy));
    const patch = loadStoredPatch()!;
    expect(patch.format).toBe("euclid-grid.v18");
    for (const id of ["distortion", "reverb", "delay", "karplus", "compressor"] as const) expect(patch.effects[id]).toMatchObject(legacy.effects[id]);
    expect(patch.effects.distortion).toMatchObject({ mode: "soft", trim: 0 });
    expect(patch.effects.reverb).toMatchObject({ space: "studio", preDelay: 0, lowCut: 0 });
    expect(patch.effects.delay).toMatchObject({ sync: false, lowCut: 0 });
    expect(patch.effects.karplus).toMatchObject({ octave: 0, excitation: 16000 });
    expect(patch.effects.compressor).toMatchObject({ knee: 30, makeup: 0 });
    expect(patch.effects.sends.kick).toMatchObject({ distortion: 40, karplus: 30 });
    localStorage.setItem("egs.arrangement.v8", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v8", variations: [{ id: "a", name: "A", patch: legacy }] }));
    expect(loadStoredArrangement(patch).variations[0].patch).toEqual(patch);
  });

  it("bounds every added parameter and round-trips expanded arrangements", () => {
    const effects = normalizeEffects({
      distortion: { mode: "fold", trim: -99 }, reverb: { space: "hall", preDelay: 999, lowCut: -1 },
      delay: { sync: true, division: "1/8D", time: 9999, lowCut: 9999 },
      karplus: { octave: 1.8, excitation: -1 }, compressor: { knee: 99, makeup: Infinity },
    });
    expect(effects.distortion).toMatchObject({ mode: "fold", trim: -24 });
    expect(effects.reverb).toMatchObject({ space: "hall", preDelay: 200, lowCut: 0 });
    expect(effects.delay).toMatchObject({ sync: true, division: "1/8D", time: 2000, lowCut: 2000 });
    expect(effects.karplus).toMatchObject({ octave: 2, excitation: 200 });
    expect(effects.compressor).toMatchObject({ knee: 40, makeup: 0 });
    const patch = normalizePatch({ ...createEmptyPatch(), effects })!;
    const arrangement = createArrangement(patch);
    saveArrangement(arrangement);
    expect(loadStoredArrangement(patch)).toEqual(arrangement);
    expect(normalizeEffects({ distortion: { mode: "invalid" }, reverb: { space: "invalid" }, delay: { division: "invalid", sync: "true" } })).toEqual(createEffects());
  });

  it("resolves musical times across the complete tempo range and remembers free time", () => {
    const delay = { ...createEffects().delay, time: 730, sync: true, division: "1/8D" as const };
    expect(delaySeconds(delay, 120)).toBe(0.375);
    expect(delaySeconds(delay, 60)).toBe(0.75);
    expect(delaySeconds({ ...delay, division: "1/8T" }, 120)).toBeCloseTo(1 / 6);
    expect(delaySeconds({ ...delay, division: "1/2" }, 20)).toBe(6);
    expect(delaySeconds({ ...delay, sync: false }, 120)).toBe(0.73);
    expect(waveguideFeedback(100)).toBeLessThan(1);
  });

  it("keeps all distortion curves finite, bounded and free of DC offsets", () => {
    for (const mode of ["soft", "hard", "fold"] as const) for (const drive of [0, 35, 100]) {
      expect(distortionSample(0, { mode, drive })).toBe(0);
      for (let i = 0; i <= 100; i++) {
        const output = distortionSample(i / 100, { mode, drive });
        expect(Math.abs(output)).toBeLessThanOrEqual(1);
        expect(distortionSample(-i / 100, { mode, drive })).toBeCloseTo(-output);
      }
    }
    expect(compressedDb(-30, -24, 4, 0)).toBe(-30);
    expect(compressedDb(-12, -24, 4, 0)).toBe(-21);
    expect(compressedDb(-24, -24, 4, 12)).toBeCloseTo(-25.125);
  });
});
