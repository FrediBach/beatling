import { afterEach, expect, it } from "vitest";
import { createEmptyPatch, loadStoredPatch, savePatch } from "./patch";
import { createArrangement, loadStoredArrangement, saveArrangement } from "./variations";
import { normalizeCustomVoiceSettings } from "./voice-config";
import type { VoiceId } from "./types";

const additions: Partial<Record<VoiceId, Record<string, number>>> = {
  kick: { bodyTone: 0, bodyLevel: 100, bodyAttack: 0 }, snare: { upperLevel: 67, upperDecay: 0, toneDecay: 130, pitchAmount: 1, pitchDecay: 30, noiseAttack: 0 }, clap: { burstDecay: 18, tailFilter: 0, tailAttack: 0 },
  rim: { balance: 50, noiseMode: 0, noiseDecay: 20, noiseFilter: 0, noiseQ: 0 }, cow: { balance: 50, highDamping: 0 },
  ch: { metalFocus: 9000, metalQ: 0.9, lowpass: 20000, metalDecay: 0 }, oh: { metalFocus: 9000, metalQ: 0.9, lowpass: 20000, metalDecay: 0, chokeMode: 0, chokeRelease: 10 }, cym: { metalFocus: 9000, metalQ: 0.9, lowpass: 20000, metalDecay: 0, bellLevel: 0, bellFrequency: 800, bellDecay: 500, stickLevel: 0, stickFilter: 4500, stickDecay: 15 },
  lt: { overtoneLevel: 0, overtoneRatio: 1.5, overtoneDecay: 0 }, mt: { overtoneLevel: 0, overtoneRatio: 1.5, overtoneDecay: 0 }, ht: { overtoneLevel: 0, overtoneRatio: 1.5, overtoneDecay: 0 },
  shk: { grainDepth: 0, grainRate: 60 },
  bassline: { pulseWidth: 50, filterTracking: 0, playMode: 0, glide: 0, ampDecay: 0, accentSource: 0, accentFilter: 0, accentDecay: 0 }, lead: { companionInterval: 0, pulseWidth: 50, filterTracking: 0, playMode: 0, glide: 0, filterDecay: 0, subLevel: 0 },
};

afterEach(() => localStorage.clear());

it("migrates v9 patch and arrangement storage with neutral voice defaults and saves v28", () => {
  const patch = createEmptyPatch();
  patch.voices.snare.custom.noiseDecay = 400;
  patch.voices.lead.custom.release = 900;
  patch.voices.lead.modulations = [{ source: "12", destination: "vOct", amount: 0.5 }];
  for (const [id, fields] of Object.entries(additions)) {
    for (const key of Object.keys(fields)) delete patch.voices[id as VoiceId].custom[key];
  }
  const legacy = { ...patch, format: "euclid-grid.v9" };
  localStorage.setItem("egs.patch.v9", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v9", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v9", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  for (const [id, fields] of Object.entries(additions)) expect(migrated.voices[id as VoiceId].custom).toMatchObject(fields);
  expect(migrated.voices.snare.custom.noiseDecay).toBe(400);
  expect(migrated.voices.lead.custom.release).toBe(900);
  expect(migrated.voices.lead.modulations).toEqual(patch.voices.lead.modulations);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  expect(arrangement.songParts[0].variationId).toBe("variation-1");
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v28")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v28")!)).toEqual(arrangement);
});

it("round-trips edited voice controls through JSON normalization", () => {
  const patch = createEmptyPatch();
  Object.assign(patch.voices.kick.custom, { bodyTone: 63, bodyLevel: 70, bodyAttack: 8 });
  Object.assign(patch.voices.snare.custom, { upperLevel: 40, upperDecay: 80, toneDecay: 305, pitchAmount: 1.75, pitchDecay: 45, noiseAttack: 8 });
  Object.assign(patch.voices.clap.custom, { burstDecay: 45, tailFilter: 700, tailAttack: 20 });
  Object.assign(patch.voices.shk.custom, { grainDepth: 65, grainRate: 90 });
  Object.assign(patch.voices.rim.custom, { balance: 20, noiseMode: 1, noiseDecay: 80, noiseFilter: 4500, noiseQ: 0.8 });
  Object.assign(patch.voices.cow.custom, { balance: 80, highDamping: 65 });
  for (const id of ["ch", "oh", "cym"] as const) Object.assign(patch.voices[id].custom, { metalFocus: 4500, metalQ: 3.2, lowpass: 6500, metalDecay: 250 });
  Object.assign(patch.voices.cym.custom, { bellLevel: 35, bellFrequency: 1100, bellDecay: 900, stickLevel: 40, stickFilter: 6000, stickDecay: 25 });
  for (const id of ["lt", "mt", "ht"] as const) Object.assign(patch.voices[id].custom, { overtoneLevel: 40, overtoneRatio: 2.25, overtoneDecay: 800 });
  patch.voices.bassline.custom.ampDecay = 900;
  Object.assign(patch.voices.bassline.custom, { accentSource: 1, accentFilter: 70, accentDecay: 40 });
  Object.assign(patch.voices.oh.custom, { chokeMode: 1, chokeRelease: 25 });
  Object.assign(patch.voices.lead.custom, { filterDecay: 200, subLevel: 35, companionInterval: 7 });
  for (const id of ["bassline", "lead"] as const) Object.assign(patch.voices[id].custom, { playMode: 1, glide: 125, filterTracking: 65, pulseWidth: 25 });
  savePatch(patch);
  const restored = loadStoredPatch()!;
  for (const [id, fields] of Object.entries(additions)) {
    for (const key of Object.keys(fields)) expect(restored.voices[id as VoiceId].custom[key]).toBe(patch.voices[id as VoiceId].custom[key]);
  }
});

it("bounds added controls and uses defaults for malformed values", () => {
  expect(normalizeCustomVoiceSettings("snare", { upperLevel: -1, upperDecay: 9999 })).toMatchObject({ upperLevel: 0, upperDecay: 600 });
  expect(normalizeCustomVoiceSettings("snare", { upperLevel: 999, upperDecay: -1 })).toMatchObject({ upperLevel: 100, upperDecay: 0 });
  expect(normalizeCustomVoiceSettings("snare", { upperLevel: "39.7", upperDecay: "82" })).toMatchObject({ upperLevel: 40, upperDecay: 80 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("snare", { upperLevel: invalid, upperDecay: invalid })).toMatchObject({ upperLevel: 67, upperDecay: 0 });
  }
  expect(normalizeCustomVoiceSettings("lead", { companionInterval: -99 }).companionInterval).toBe(-24);
  expect(normalizeCustomVoiceSettings("lead", { companionInterval: 99 }).companionInterval).toBe(24);
  expect(normalizeCustomVoiceSettings("lead", { companionInterval: "6.7" }).companionInterval).toBe(7);
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("lead", { companionInterval: invalid }).companionInterval).toBe(0);
  }
  expect(normalizeCustomVoiceSettings("rim", { noiseFilter: -1, noiseQ: 999 })).toMatchObject({ noiseFilter: 0, noiseQ: 12 });
  expect(normalizeCustomVoiceSettings("rim", { noiseFilter: 99999, noiseQ: -1 })).toMatchObject({ noiseFilter: 12000, noiseQ: 0 });
  expect(normalizeCustomVoiceSettings("rim", { noiseFilter: "4530", noiseQ: "0.84" })).toMatchObject({ noiseFilter: 4550, noiseQ: 0.8 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("rim", { noiseFilter: invalid, noiseQ: invalid })).toMatchObject({ noiseFilter: 0, noiseQ: 0 });
  }
  expect(normalizeCustomVoiceSettings("kick", { bodyLevel: -1, bodyAttack: 999 })).toMatchObject({ bodyLevel: 0, bodyAttack: 30 });
  expect(normalizeCustomVoiceSettings("kick", { bodyLevel: 999, bodyAttack: -1 })).toMatchObject({ bodyLevel: 100, bodyAttack: 0 });
  expect(normalizeCustomVoiceSettings("kick", { bodyLevel: "69.7", bodyAttack: "8.2" })).toMatchObject({ bodyLevel: 70, bodyAttack: 8 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("kick", { bodyLevel: invalid, bodyAttack: invalid })).toMatchObject({ bodyLevel: 100, bodyAttack: 0 });
  }
  for (const id of ["ch", "oh", "cym"] as const) {
    expect(normalizeCustomVoiceSettings(id, { metalFocus: -1, metalQ: 999 })).toMatchObject({ metalFocus: 1000, metalQ: 8 });
    expect(normalizeCustomVoiceSettings(id, { metalFocus: 99999, metalQ: -1 })).toMatchObject({ metalFocus: 14000, metalQ: 0.1 });
    expect(normalizeCustomVoiceSettings(id, { metalFocus: "4530", metalQ: "3.24" })).toMatchObject({ metalFocus: 4550, metalQ: 3.2 });
    for (const invalid of [null, false, "", {}, NaN, Infinity]) {
      expect(normalizeCustomVoiceSettings(id, { metalFocus: invalid, metalQ: invalid })).toMatchObject({ metalFocus: 9000, metalQ: 0.9 });
    }
  }
  expect(normalizeCustomVoiceSettings("cym", { stickLevel: -1, stickFilter: 99999, stickDecay: -1 })).toMatchObject({ stickLevel: 0, stickFilter: 12000, stickDecay: 10 });
  expect(normalizeCustomVoiceSettings("cym", { stickLevel: 999, stickFilter: -1, stickDecay: 999 })).toMatchObject({ stickLevel: 100, stickFilter: 800, stickDecay: 120 });
  expect(normalizeCustomVoiceSettings("cym", { stickLevel: "39.7", stickFilter: "6030", stickDecay: "24.8" })).toMatchObject({ stickLevel: 40, stickFilter: 6050, stickDecay: 25 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("cym", { stickLevel: invalid, stickFilter: invalid, stickDecay: invalid })).toMatchObject({ stickLevel: 0, stickFilter: 4500, stickDecay: 15 });
  }
  expect(normalizeCustomVoiceSettings("cow", { highDamping: -1 }).highDamping).toBe(0);
  expect(normalizeCustomVoiceSettings("cow", { highDamping: 999 }).highDamping).toBe(100);
  expect(normalizeCustomVoiceSettings("cow", { highDamping: "64.7" }).highDamping).toBe(65);
  for (const highDamping of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("cow", { highDamping }).highDamping).toBe(0);
  }
  expect(normalizeCustomVoiceSettings("clap", { tailFilter: -1, tailAttack: 999 })).toMatchObject({ tailFilter: 0, tailAttack: 80 });
  expect(normalizeCustomVoiceSettings("clap", { tailFilter: 99999, tailAttack: -1 })).toMatchObject({ tailFilter: 12000, tailAttack: 0 });
  expect(normalizeCustomVoiceSettings("clap", { tailFilter: "730", tailAttack: "19.8" })).toMatchObject({ tailFilter: 750, tailAttack: 20 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("clap", { tailFilter: invalid, tailAttack: invalid })).toMatchObject({ tailFilter: 0, tailAttack: 0 });
  }
  for (const id of ["lt", "mt", "ht"] as const) {
    expect(normalizeCustomVoiceSettings(id, { overtoneRatio: -1, overtoneDecay: 9999 })).toMatchObject({ overtoneRatio: 1, overtoneDecay: 1500 });
    expect(normalizeCustomVoiceSettings(id, { overtoneRatio: 999, overtoneDecay: -1 })).toMatchObject({ overtoneRatio: 4, overtoneDecay: 0 });
    expect(normalizeCustomVoiceSettings(id, { overtoneRatio: "2.27", overtoneDecay: "83" })).toMatchObject({ overtoneRatio: 2.25, overtoneDecay: 85 });
    for (const invalid of [null, false, "", {}, NaN, Infinity]) {
      expect(normalizeCustomVoiceSettings(id, { overtoneRatio: invalid, overtoneDecay: invalid })).toMatchObject({ overtoneRatio: 1.5, overtoneDecay: 0 });
    }
  }
  expect(normalizeCustomVoiceSettings("shk", { grainDepth: -1, grainRate: 999 })).toMatchObject({ grainDepth: 0, grainRate: 120 });
  expect(normalizeCustomVoiceSettings("shk", { grainDepth: 999, grainRate: -1 })).toMatchObject({ grainDepth: 100, grainRate: 20 });
  expect(normalizeCustomVoiceSettings("shk", { grainDepth: "64.7", grainRate: "89.7" })).toMatchObject({ grainDepth: 65, grainRate: 90 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("shk", { grainDepth: invalid, grainRate: invalid })).toMatchObject({ grainDepth: 0, grainRate: 60 });
  }
  expect(normalizeCustomVoiceSettings("snare", { toneDecay: 9999 }).toneDecay).toBe(600);
  expect(normalizeCustomVoiceSettings("snare", { pitchAmount: 999, pitchDecay: -5, noiseAttack: 99 })).toMatchObject({ pitchAmount: 4, pitchDecay: 5, noiseAttack: 40 });
  expect(normalizeCustomVoiceSettings("snare", { pitchAmount: 0, pitchDecay: 999, noiseAttack: -1 })).toMatchObject({ pitchAmount: 1, pitchDecay: 150, noiseAttack: 0 });
  expect(normalizeCustomVoiceSettings("snare", { pitchAmount: "1.73", pitchDecay: 31.6, noiseAttack: 8.1 })).toMatchObject({ pitchAmount: 1.75, pitchDecay: 32, noiseAttack: 8 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("snare", { pitchAmount: invalid, pitchDecay: invalid, noiseAttack: invalid })).toMatchObject({ pitchAmount: 1, pitchDecay: 30, noiseAttack: 0 });
  }
  expect(normalizeCustomVoiceSettings("clap", { burstDecay: -20 }).burstDecay).toBe(5);
  expect(normalizeCustomVoiceSettings("lead", { filterDecay: 237, subLevel: 999 })).toMatchObject({ filterDecay: 240, subLevel: 100 });
  for (const lowpass of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("ch", { lowpass }).lowpass).toBe(20000);
  }
  expect(normalizeCustomVoiceSettings("ch", { lowpass: "4500" }).lowpass).toBe(4500);
  expect(normalizeCustomVoiceSettings("oh", { chokeMode: 99, chokeRelease: -20 })).toMatchObject({ chokeMode: 1, chokeRelease: 5 });
  expect(normalizeCustomVoiceSettings("bassline", { accentSource: -1, accentFilter: 900, accentDecay: -90 })).toMatchObject({ accentSource: 0, accentFilter: 100, accentDecay: 0 });
  expect(normalizeCustomVoiceSettings("bassline", { playMode: 90, glide: 9999 })).toMatchObject({ playMode: 1, glide: 500 });
  expect(normalizeCustomVoiceSettings("lead", { playMode: null, glide: "" })).toMatchObject({ playMode: 0, glide: 0 });
  expect(normalizeCustomVoiceSettings("rim", { noiseMode: 99, noiseDecay: -1 })).toMatchObject({ noiseMode: 1, noiseDecay: 5 });
  expect(normalizeCustomVoiceSettings("rim", { noiseMode: null, noiseDecay: false })).toMatchObject({ noiseMode: 0, noiseDecay: 20 });
  expect(normalizeCustomVoiceSettings("ch", { metalDecay: 9000 }).metalDecay).toBe(300);
  expect(normalizeCustomVoiceSettings("oh", { metalDecay: 1755 }).metalDecay).toBe(1760);
  expect(normalizeCustomVoiceSettings("cym", { metalDecay: -20 }).metalDecay).toBe(0);
  for (const metalDecay of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("cym", { metalDecay }).metalDecay).toBe(0);
  }
  expect(normalizeCustomVoiceSettings("cym", { bellLevel: 500, bellFrequency: -1, bellDecay: 9000 })).toMatchObject({ bellLevel: 100, bellFrequency: 200, bellDecay: 2000 });
  expect(normalizeCustomVoiceSettings("cym", { bellLevel: -1, bellFrequency: 9000, bellDecay: -1 })).toMatchObject({ bellLevel: 0, bellFrequency: 2000, bellDecay: 20 });
  expect(normalizeCustomVoiceSettings("cym", { bellFrequency: "815", bellDecay: 237 })).toMatchObject({ bellFrequency: 820, bellDecay: 240 });
  for (const invalid of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("cym", { bellLevel: invalid, bellFrequency: invalid, bellDecay: invalid })).toMatchObject({ bellLevel: 0, bellFrequency: 800, bellDecay: 500 });
  }
  for (const id of ["bassline", "lead"] as const) {
    expect(normalizeCustomVoiceSettings(id, { pulseWidth: -1 }).pulseWidth).toBe(10);
    expect(normalizeCustomVoiceSettings(id, { pulseWidth: 999 }).pulseWidth).toBe(90);
    expect(normalizeCustomVoiceSettings(id, { pulseWidth: "27.7" }).pulseWidth).toBe(28);
    for (const pulseWidth of [null, false, "", {}, NaN, Infinity]) {
      expect(normalizeCustomVoiceSettings(id, { pulseWidth }).pulseWidth).toBe(50);
    }
    expect(normalizeCustomVoiceSettings(id, { filterTracking: -10 }).filterTracking).toBe(0);
    expect(normalizeCustomVoiceSettings(id, { filterTracking: 900 }).filterTracking).toBe(100);
    expect(normalizeCustomVoiceSettings(id, { filterTracking: "62.7" }).filterTracking).toBe(63);
    for (const filterTracking of [null, false, "", {}, NaN, Infinity]) {
      expect(normalizeCustomVoiceSettings(id, { filterTracking }).filterTracking).toBe(0);
    }
  }
});

it("loads v10 articulation neutrally while preserving the first voice improvements", () => {
  const patch = createEmptyPatch();
  patch.voices.oh.custom.lowpass = 5000;
  patch.voices.bassline.custom.ampDecay = 850;
  patch.voices.bassline.custom.accent = 65;
  for (const key of ["chokeMode", "chokeRelease"]) delete patch.voices.oh.custom[key];
  for (const key of ["accentSource", "accentFilter", "accentDecay"]) delete patch.voices.bassline.custom[key];
  const legacy = { ...patch, format: "euclid-grid.v10" };
  localStorage.setItem("egs.patch.v10", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v10", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v10", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.voices.oh.custom).toMatchObject({ lowpass: 5000, chokeMode: 0, chokeRelease: 10 });
  expect(migrated.voices.bassline.custom).toMatchObject({ ampDecay: 850, accent: 65, accentSource: 0, accentFilter: 0, accentDecay: 0 });
  expect(loadStoredArrangement(createEmptyPatch()).variations[0].patch).toEqual(migrated);
  savePatch(migrated);
  // Prefer the newer record after migration even while the older key still exists.
  migrated.voices.oh.custom.chokeMode = 1;
  savePatch(migrated);
  expect(loadStoredPatch()!.voices.oh.custom.chokeMode).toBe(1);
});

it("migrates v11 synths to polyphonic playback while retaining accents and hat choking", () => {
  const patch = createEmptyPatch();
  for (const id of ["bassline", "lead"] as const) {
    delete patch.voices[id].custom.playMode;
    delete patch.voices[id].custom.glide;
  }
  Object.assign(patch.voices.bassline.custom, { accentSource: 1, accentFilter: 60, accentDecay: 30 });
  Object.assign(patch.voices.oh.custom, { chokeMode: 1, chokeRelease: 20 });
  const legacy = { ...patch, format: "euclid-grid.v11" };
  localStorage.setItem("egs.patch.v11", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v11", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v11", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  for (const id of ["bassline", "lead"] as const) expect(migrated.voices[id].custom).toMatchObject({ playMode: 0, glide: 0 });
  expect(migrated.voices.bassline.custom).toMatchObject({ accentSource: 1, accentFilter: 60, accentDecay: 30 });
  expect(migrated.voices.oh.custom).toMatchObject({ chokeMode: 1, chokeRelease: 20 });
  expect(loadStoredArrangement(createEmptyPatch()).variations[0].patch).toEqual(migrated);
});

it("migrates v12 percussion to linked envelopes and retains edited layers on save", () => {
  const patch = createEmptyPatch();
  delete patch.voices.rim.custom.noiseMode;
  delete patch.voices.rim.custom.noiseDecay;
  Object.assign(patch.voices.rim.custom, { toneLevel: 30, noiseLevel: 60, duration: 70 });
  for (const id of ["ch", "oh", "cym"] as const) delete patch.voices[id].custom.metalDecay;
  Object.assign(patch.voices.oh.custom, { duration: 800, chokeMode: 1 });
  Object.assign(patch.voices.lead.custom, { playMode: 1, glide: 150 });
  const legacy = { ...patch, format: "euclid-grid.v12" };
  localStorage.setItem("egs.patch.v12", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v12", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v12", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.rim.custom).toMatchObject({ noiseMode: 0, noiseDecay: 20, toneLevel: 30, noiseLevel: 60, duration: 70 });
  for (const id of ["ch", "oh", "cym"] as const) expect(migrated.voices[id].custom.metalDecay).toBe(0);
  expect(migrated.voices.oh.custom).toMatchObject({ duration: 800, chokeMode: 1 });
  expect(migrated.voices.lead.custom).toMatchObject({ playMode: 1, glide: 150 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.rim.custom, { noiseMode: 1, noiseDecay: 90 });
  migrated.voices.oh.custom.metalDecay = 1500;
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v13 cymbals with a disabled bell and retains bell edits in patch and arrangement storage", () => {
  const patch = createEmptyPatch();
  for (const key of ["bellLevel", "bellFrequency", "bellDecay"]) delete patch.voices.cym.custom[key];
  Object.assign(patch.voices.cym.custom, { duration: 1800, metalDecay: 300, lowpass: 6500 });
  Object.assign(patch.voices.rim.custom, { noiseMode: 1, noiseDecay: 90 });
  const legacy = { ...patch, format: "euclid-grid.v13" };
  localStorage.setItem("egs.patch.v13", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v13", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v13", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.cym.custom).toMatchObject({ bellLevel: 0, bellFrequency: 800, bellDecay: 500, duration: 1800, metalDecay: 300, lowpass: 6500 });
  expect(migrated.voices.rim.custom).toMatchObject({ noiseMode: 1, noiseDecay: 90 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.cym.custom, { bellLevel: 35, bellFrequency: 1100, bellDecay: 900 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v14 synths to fixed filters and retains tracking edits on save", () => {
  const patch = createEmptyPatch();
  for (const id of ["bassline", "lead"] as const) {
    delete patch.voices[id].custom.filterTracking;
    Object.assign(patch.voices[id].custom, { playMode: 1, glide: 150, cutoff: 1000 });
  }
  Object.assign(patch.voices.cym.custom, { bellLevel: 35, bellFrequency: 1100, bellDecay: 900 });
  const legacy = { ...patch, format: "euclid-grid.v14" };
  localStorage.setItem("egs.patch.v14", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v14", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v14", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  for (const id of ["bassline", "lead"] as const) expect(migrated.voices[id].custom).toMatchObject({ filterTracking: 0, playMode: 1, glide: 150, cutoff: 1000 });
  expect(migrated.voices.cym.custom).toMatchObject({ bellLevel: 35, bellFrequency: 1100, bellDecay: 900 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.variations[0].patch).toEqual(migrated);
  migrated.voices.bassline.custom.filterTracking = 100;
  migrated.voices.lead.custom.filterTracking = 50;
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v15 snares with neutral articulation and retains edits in patch and arrangement storage", () => {
  const patch = createEmptyPatch();
  for (const key of ["pitchAmount", "pitchDecay", "noiseAttack"]) delete patch.voices.snare.custom[key];
  Object.assign(patch.voices.snare.custom, { toneFrequency: 240, toneSpread: 1.5, toneDecay: 200, noiseDecay: 400 });
  patch.voices.lead.custom.filterTracking = 65;
  const legacy = { ...patch, format: "euclid-grid.v15" };
  localStorage.setItem("egs.patch.v15", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v15", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v15", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.snare.custom).toMatchObject({ pitchAmount: 1, pitchDecay: 30, noiseAttack: 0, toneFrequency: 240, toneSpread: 1.5, toneDecay: 200, noiseDecay: 400 });
  expect(migrated.voices.lead.custom.filterTracking).toBe(65);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.snare.custom, { pitchAmount: 1.75, pitchDecay: 45, noiseAttack: 8 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v16 synths to native square widths and retains pulse edits on save", () => {
  const patch = createEmptyPatch();
  for (const id of ["bassline", "lead"] as const) {
    delete patch.voices[id].custom.pulseWidth;
    Object.assign(patch.voices[id].custom, { waveform: 1, filterTracking: 65, playMode: 1, glide: 150 });
  }
  Object.assign(patch.voices.snare.custom, { pitchAmount: 1.5, pitchDecay: 25, noiseAttack: 5 });
  const legacy = { ...patch, format: "euclid-grid.v16" };
  localStorage.setItem("egs.patch.v16", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v16", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v16", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  for (const id of ["bassline", "lead"] as const) expect(migrated.voices[id].custom).toMatchObject({ pulseWidth: 50, waveform: 1, filterTracking: 65, playMode: 1, glide: 150 });
  expect(migrated.voices.snare.custom).toMatchObject({ pitchAmount: 1.5, pitchDecay: 25, noiseAttack: 5 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.variations[0].patch).toEqual(migrated);
  migrated.voices.bassline.custom.pulseWidth = 25;
  migrated.voices.lead.custom.pulseWidth = 70;
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v17 shakers with texture off and retains grain edits in patch and arrangement storage", () => {
  const patch = createEmptyPatch();
  delete patch.voices.shk.custom.grainDepth;
  delete patch.voices.shk.custom.grainRate;
  Object.assign(patch.voices.shk.custom, { attack: 25, duration: 200, filterFrequency: 6000, noiseLevel: 70 });
  patch.voices.lead.custom.pulseWidth = 25;
  const legacy = { ...patch, format: "euclid-grid.v17" };
  localStorage.setItem("egs.patch.v17", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v17", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v17", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.shk.custom).toMatchObject({ grainDepth: 0, grainRate: 60, attack: 25, duration: 200, filterFrequency: 6000, noiseLevel: 70 });
  expect(migrated.voices.lead.custom.pulseWidth).toBe(25);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.shk.custom, { grainDepth: 65, grainRate: 90 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v18 toms with their original shell tuning and damping and retains independent edits", () => {
  const patch = createEmptyPatch();
  for (const id of ["lt", "mt", "ht"] as const) {
    delete patch.voices[id].custom.overtoneRatio;
    delete patch.voices[id].custom.overtoneDecay;
    Object.assign(patch.voices[id].custom, { overtoneLevel: 45, duration: 600, pitchAmount: 2, noiseLevel: 25 });
  }
  Object.assign(patch.voices.shk.custom, { grainDepth: 65, grainRate: 90 });
  const legacy = { ...patch, format: "euclid-grid.v18" };
  localStorage.setItem("egs.patch.v18", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v18", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v18", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  for (const id of ["lt", "mt", "ht"] as const) expect(migrated.voices[id].custom).toMatchObject({ overtoneRatio: 1.5, overtoneDecay: 0, overtoneLevel: 45, duration: 600, pitchAmount: 2, noiseLevel: 25 });
  expect(migrated.voices.shk.custom).toMatchObject({ grainDepth: 65, grainRate: 90 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.lt.custom, { overtoneRatio: 2.25, overtoneDecay: 80 });
  Object.assign(migrated.voices.mt.custom, { overtoneRatio: 1.75, overtoneDecay: 350 });
  Object.assign(migrated.voices.ht.custom, { overtoneRatio: 3, overtoneDecay: 800 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v19 claps with a linked immediate tail and retains independent tail edits", () => {
  const patch = createEmptyPatch();
  delete patch.voices.clap.custom.tailFilter;
  delete patch.voices.clap.custom.tailAttack;
  Object.assign(patch.voices.clap.custom, { burstCount: 5, burstSpacing: 15, burstDecay: 30, filterFrequency: 1600, filterQ: 2, tailDecay: 400, tailLevel: 60 });
  Object.assign(patch.voices.mt.custom, { overtoneLevel: 40, overtoneRatio: 2.25, overtoneDecay: 800 });
  const legacy = { ...patch, format: "euclid-grid.v19" };
  localStorage.setItem("egs.patch.v19", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v19", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v19", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.clap.custom).toMatchObject({ tailFilter: 0, tailAttack: 0, burstCount: 5, burstSpacing: 15, burstDecay: 30, filterFrequency: 1600, filterQ: 2, tailDecay: 400, tailLevel: 60 });
  expect(migrated.voices.mt.custom).toMatchObject({ overtoneLevel: 40, overtoneRatio: 2.25, overtoneDecay: 800 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.clap.custom, { tailFilter: 700, tailAttack: 20 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v20 cowbells with equal partial decay and retains damping edits", () => {
  const patch = createEmptyPatch();
  delete patch.voices.cow.custom.highDamping;
  Object.assign(patch.voices.cow.custom, { balance: 70, lowFrequency: 500, highFrequency: 900, filterFrequency: 3000, duration: 600, toneLevel: 40 });
  Object.assign(patch.voices.clap.custom, { tailFilter: 700, tailAttack: 20 });
  const legacy = { ...patch, format: "euclid-grid.v20" };
  localStorage.setItem("egs.patch.v20", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v20", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v20", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.cow.custom).toMatchObject({ highDamping: 0, balance: 70, lowFrequency: 500, highFrequency: 900, filterFrequency: 3000, duration: 600, toneLevel: 40 });
  expect(migrated.voices.clap.custom).toMatchObject({ tailFilter: 700, tailAttack: 20 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  migrated.voices.cow.custom.highDamping = 65;
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v21 cymbals with stick noise off and retains stick edits", () => {
  const patch = createEmptyPatch();
  for (const key of ["stickLevel", "stickFilter", "stickDecay"]) delete patch.voices.cym.custom[key];
  Object.assign(patch.voices.cym.custom, { bellLevel: 35, bellFrequency: 1100, bellDecay: 900, metalDecay: 800, duration: 1800, noiseLevel: 25, lowpass: 6500 });
  patch.voices.cow.custom.highDamping = 65;
  const legacy = { ...patch, format: "euclid-grid.v21" };
  localStorage.setItem("egs.patch.v21", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v21", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v21", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.cym.custom).toMatchObject({ stickLevel: 0, stickFilter: 4500, stickDecay: 15, bellLevel: 35, bellFrequency: 1100, bellDecay: 900, metalDecay: 800, duration: 1800, noiseLevel: 25, lowpass: 6500 });
  expect(migrated.voices.cow.custom.highDamping).toBe(65);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.cym.custom, { stickLevel: 40, stickFilter: 6000, stickDecay: 25 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v23 kick envelopes with neutral defaults and retains layer edits", () => {
  const patch = createEmptyPatch();
  delete patch.voices.kick.custom.bodyLevel;
  delete patch.voices.kick.custom.bodyAttack;
  Object.assign(patch.voices.kick.custom, { bodyTone: 40, bodyFrequency: 60, bodyDecay: 400, pitchAmount: 4, clickLevel: 50 });
  Object.assign(patch.voices.oh.custom, { metalFocus: 4500, metalQ: 3, chokeMode: 1 });
  const legacy = { ...patch, format: "euclid-grid.v23" };
  localStorage.setItem("egs.patch.v23", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v23", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v23", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.kick.custom).toMatchObject({ bodyLevel: 100, bodyAttack: 0, bodyTone: 40, bodyFrequency: 60, bodyDecay: 400, pitchAmount: 4, clickLevel: 50 });
  expect(migrated.voices.oh.custom).toMatchObject({ metalFocus: 4500, metalQ: 3, chokeMode: 1 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.kick.custom, { bodyLevel: 70, bodyAttack: 8 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v28")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v28")!)).toEqual(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v22 metallic voices with their original filters and retains focus edits", () => {
  const patch = createEmptyPatch();
  for (const id of ["ch", "oh", "cym"] as const) {
    delete patch.voices[id].custom.metalFocus;
    delete patch.voices[id].custom.metalQ;
    Object.assign(patch.voices[id].custom, { highpass: 4000, lowpass: 6500, metalBase: 50, metalDecay: 200, noiseLevel: 25 });
  }
  Object.assign(patch.voices.oh.custom, { chokeMode: 1, chokeRelease: 20 });
  Object.assign(patch.voices.cym.custom, { bellLevel: 40, stickLevel: 30, stickFilter: 6000 });
  const legacy = { ...patch, format: "euclid-grid.v22" };
  localStorage.setItem("egs.patch.v22", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v22", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v22", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  for (const id of ["ch", "oh", "cym"] as const) expect(migrated.voices[id].custom).toMatchObject({ metalFocus: 9000, metalQ: 0.9, highpass: 4000, lowpass: 6500, metalBase: 50, metalDecay: 200, noiseLevel: 25 });
  expect(migrated.voices.oh.custom).toMatchObject({ chokeMode: 1, chokeRelease: 20 });
  expect(migrated.voices.cym.custom).toMatchObject({ bellLevel: 40, stickLevel: 30, stickFilter: 6000 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.ch.custom, { metalFocus: 4500, metalQ: 3.2 });
  Object.assign(migrated.voices.oh.custom, { metalFocus: 6500, metalQ: 1.5 });
  Object.assign(migrated.voices.cym.custom, { metalFocus: 8000, metalQ: 0.5 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v24 rim noise with body-linked filtering and retains independent edits", () => {
  const patch = createEmptyPatch();
  delete patch.voices.rim.custom.noiseFilter;
  delete patch.voices.rim.custom.noiseQ;
  Object.assign(patch.voices.rim.custom, { noiseMode: 1, noiseDecay: 90, filterFrequency: 2000, filterQ: 2, duration: 20, balance: 25, noiseLevel: 40 });
  Object.assign(patch.voices.kick.custom, { bodyLevel: 70, bodyAttack: 8 });
  const legacy = { ...patch, format: "euclid-grid.v24" };
  localStorage.setItem("egs.patch.v24", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v24", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v24", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.rim.custom).toMatchObject({ noiseFilter: 0, noiseQ: 0, noiseMode: 1, noiseDecay: 90, filterFrequency: 2000, filterQ: 2, duration: 20, balance: 25, noiseLevel: 40 });
  expect(migrated.voices.kick.custom).toMatchObject({ bodyLevel: 70, bodyAttack: 8 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.rim.custom, { noiseFilter: 4500, noiseQ: 0.8 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v28")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v28")!)).toEqual(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v25 lead companions in unison and retains interval edits", () => {
  const patch = createEmptyPatch();
  delete patch.voices.lead.custom.companionInterval;
  Object.assign(patch.voices.lead.custom, { pulseMix: 50, detune: -15, pulseWidth: 30, subLevel: 40, playMode: 1, glide: 200, filterTracking: 65 });
  Object.assign(patch.voices.rim.custom, { noiseMode: 1, noiseFilter: 4500, noiseQ: 0.8 });
  const legacy = { ...patch, format: "euclid-grid.v25" };
  localStorage.setItem("egs.patch.v25", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v25", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v25", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.lead.custom).toMatchObject({ companionInterval: 0, pulseMix: 50, detune: -15, pulseWidth: 30, subLevel: 40, playMode: 1, glide: 200, filterTracking: 65 });
  expect(migrated.voices.rim.custom).toMatchObject({ noiseMode: 1, noiseFilter: 4500, noiseQ: 0.8 });
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  migrated.voices.lead.custom.companionInterval = -12;
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v28")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v28")!)).toEqual(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v26 snare shells with their original balance and linked length", () => {
  const patch = createEmptyPatch();
  delete patch.voices.snare.custom.upperLevel;
  delete patch.voices.snare.custom.upperDecay;
  Object.assign(patch.voices.snare.custom, { toneLevel: 60, toneDecay: 300, toneSpread: 1.5, pitchAmount: 2, pitchDecay: 30, noiseAttack: 8, noiseDecay: 400 });
  patch.voices.lead.custom.companionInterval = 7;
  const legacy = { ...patch, format: "euclid-grid.v26" };
  localStorage.setItem("egs.patch.v26", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v26", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v26", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));
  const migrated = loadStoredPatch()!;
  expect(migrated.format).toBe("euclid-grid.v28");
  expect(migrated.voices.snare.custom).toMatchObject({ upperLevel: 67, upperDecay: 0, toneLevel: 60, toneDecay: 300, toneSpread: 1.5, pitchAmount: 2, pitchDecay: 30, noiseAttack: 8, noiseDecay: 400 });
  expect(migrated.voices.lead.custom.companionInterval).toBe(7);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  Object.assign(migrated.voices.snare.custom, { upperLevel: 40, upperDecay: 80 });
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v28")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v28")!)).toEqual(arrangement);
  expect(loadStoredPatch()).toEqual(migrated);
  expect(loadStoredArrangement(createEmptyPatch())).toEqual(arrangement);
});

it("migrates v27 voices with solo off and saves v28", () => {
  const patch = createEmptyPatch();
  const legacyVoice = patch.voices.kick as Partial<typeof patch.voices.kick>;
  delete legacyVoice.solo;
  const legacy = { ...patch, format: "euclid-grid.v27" };
  localStorage.setItem("egs.patch.v27", JSON.stringify(legacy));
  localStorage.setItem("egs.arrangement.v27", JSON.stringify({ ...createArrangement(patch), format: "euclid-grid.arrangement.v27", variations: [{ id: "variation-1", name: "A", patch: legacy }] }));

  const migrated = loadStoredPatch()!;
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(migrated).toMatchObject({ format: "euclid-grid.v28", voices: { kick: { solo: false } } });
  expect(arrangement.format).toBe("euclid-grid.arrangement.v28");
  expect(arrangement.variations[0].patch.voices.kick.solo).toBe(false);

  migrated.voices.kick.solo = true;
  arrangement.variations[0].patch = migrated;
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v28")!).voices.kick.solo).toBe(true);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v28")!).variations[0].patch.voices.kick.solo).toBe(true);
});
