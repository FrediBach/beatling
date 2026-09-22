import { afterEach, expect, it } from "vitest";
import { createEmptyPatch, loadStoredPatch, savePatch } from "./patch";
import { createArrangement, loadStoredArrangement, saveArrangement } from "./variations";
import { normalizeCustomVoiceSettings } from "./voice-config";
import type { VoiceId } from "./types";

const additions: Partial<Record<VoiceId, Record<string, number>>> = {
  kick: { bodyTone: 0 }, snare: { toneDecay: 130, pitchAmount: 1, pitchDecay: 30, noiseAttack: 0 }, clap: { burstDecay: 18 },
  rim: { balance: 50, noiseMode: 0, noiseDecay: 20 }, cow: { balance: 50 },
  ch: { lowpass: 20000, metalDecay: 0 }, oh: { lowpass: 20000, metalDecay: 0, chokeMode: 0, chokeRelease: 10 }, cym: { lowpass: 20000, metalDecay: 0, bellLevel: 0, bellFrequency: 800, bellDecay: 500 },
  lt: { overtoneLevel: 0 }, mt: { overtoneLevel: 0 }, ht: { overtoneLevel: 0 },
  bassline: { filterTracking: 0, playMode: 0, glide: 0, ampDecay: 0, accentSource: 0, accentFilter: 0, accentDecay: 0 }, lead: { filterTracking: 0, playMode: 0, glide: 0, filterDecay: 0, subLevel: 0 },
};

afterEach(() => localStorage.clear());

it("migrates v9 patch and arrangement storage with neutral voice defaults and saves v16", () => {
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
  expect(migrated.format).toBe("euclid-grid.v16");
  for (const [id, fields] of Object.entries(additions)) expect(migrated.voices[id as VoiceId].custom).toMatchObject(fields);
  expect(migrated.voices.snare.custom.noiseDecay).toBe(400);
  expect(migrated.voices.lead.custom.release).toBe(900);
  expect(migrated.voices.lead.modulations).toEqual(patch.voices.lead.modulations);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v16");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  expect(arrangement.songParts[0].variationId).toBe("variation-1");
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v16")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v16")!)).toEqual(arrangement);
});

it("round-trips edited voice controls through JSON normalization", () => {
  const patch = createEmptyPatch();
  Object.assign(patch.voices.kick.custom, { bodyTone: 63 });
  Object.assign(patch.voices.snare.custom, { toneDecay: 305, pitchAmount: 1.75, pitchDecay: 45, noiseAttack: 8 });
  Object.assign(patch.voices.clap.custom, { burstDecay: 45 });
  Object.assign(patch.voices.rim.custom, { balance: 20, noiseMode: 1, noiseDecay: 80 });
  Object.assign(patch.voices.cow.custom, { balance: 80 });
  for (const id of ["ch", "oh", "cym"] as const) Object.assign(patch.voices[id].custom, { lowpass: 6500, metalDecay: 250 });
  Object.assign(patch.voices.cym.custom, { bellLevel: 35, bellFrequency: 1100, bellDecay: 900 });
  for (const id of ["lt", "mt", "ht"] as const) patch.voices[id].custom.overtoneLevel = 40;
  patch.voices.bassline.custom.ampDecay = 900;
  Object.assign(patch.voices.bassline.custom, { accentSource: 1, accentFilter: 70, accentDecay: 40 });
  Object.assign(patch.voices.oh.custom, { chokeMode: 1, chokeRelease: 25 });
  Object.assign(patch.voices.lead.custom, { filterDecay: 200, subLevel: 35 });
  for (const id of ["bassline", "lead"] as const) Object.assign(patch.voices[id].custom, { playMode: 1, glide: 125, filterTracking: 65 });
  savePatch(patch);
  const restored = loadStoredPatch()!;
  for (const [id, fields] of Object.entries(additions)) {
    for (const key of Object.keys(fields)) expect(restored.voices[id as VoiceId].custom[key]).toBe(patch.voices[id as VoiceId].custom[key]);
  }
});

it("bounds added controls and uses defaults for malformed values", () => {
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
  expect(migrated.format).toBe("euclid-grid.v16");
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
  expect(migrated.format).toBe("euclid-grid.v16");
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
  expect(migrated.format).toBe("euclid-grid.v16");
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
  expect(migrated.format).toBe("euclid-grid.v16");
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
  expect(migrated.format).toBe("euclid-grid.v16");
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
