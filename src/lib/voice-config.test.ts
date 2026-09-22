import { afterEach, expect, it } from "vitest";
import { createEmptyPatch, loadStoredPatch, savePatch } from "./patch";
import { createArrangement, loadStoredArrangement, saveArrangement } from "./variations";
import { normalizeCustomVoiceSettings } from "./voice-config";
import type { VoiceId } from "./types";

const additions: Partial<Record<VoiceId, Record<string, number>>> = {
  kick: { bodyTone: 0 }, snare: { toneDecay: 130 }, clap: { burstDecay: 18 },
  rim: { balance: 50 }, cow: { balance: 50 },
  ch: { lowpass: 20000 }, oh: { lowpass: 20000, chokeMode: 0, chokeRelease: 10 }, cym: { lowpass: 20000 },
  lt: { overtoneLevel: 0 }, mt: { overtoneLevel: 0 }, ht: { overtoneLevel: 0 },
  bassline: { ampDecay: 0, accentSource: 0, accentFilter: 0, accentDecay: 0 }, lead: { filterDecay: 0, subLevel: 0 },
};

afterEach(() => localStorage.clear());

it("migrates v9 patch and arrangement storage with neutral voice defaults and saves v11", () => {
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
  expect(migrated.format).toBe("euclid-grid.v11");
  for (const [id, fields] of Object.entries(additions)) expect(migrated.voices[id as VoiceId].custom).toMatchObject(fields);
  expect(migrated.voices.snare.custom.noiseDecay).toBe(400);
  expect(migrated.voices.lead.custom.release).toBe(900);
  expect(migrated.voices.lead.modulations).toEqual(patch.voices.lead.modulations);
  const arrangement = loadStoredArrangement(createEmptyPatch());
  expect(arrangement.format).toBe("euclid-grid.arrangement.v11");
  expect(arrangement.variations[0].patch).toEqual(migrated);
  expect(arrangement.songParts[0].variationId).toBe("variation-1");
  savePatch(migrated);
  saveArrangement(arrangement);
  expect(JSON.parse(localStorage.getItem("egs.patch.v11")!)).toEqual(migrated);
  expect(JSON.parse(localStorage.getItem("egs.arrangement.v11")!)).toEqual(arrangement);
});

it("round-trips edited voice controls through JSON normalization", () => {
  const patch = createEmptyPatch();
  Object.assign(patch.voices.kick.custom, { bodyTone: 63 });
  Object.assign(patch.voices.snare.custom, { toneDecay: 305 });
  Object.assign(patch.voices.clap.custom, { burstDecay: 45 });
  Object.assign(patch.voices.rim.custom, { balance: 20 });
  Object.assign(patch.voices.cow.custom, { balance: 80 });
  for (const id of ["ch", "oh", "cym"] as const) patch.voices[id].custom.lowpass = 6500;
  for (const id of ["lt", "mt", "ht"] as const) patch.voices[id].custom.overtoneLevel = 40;
  patch.voices.bassline.custom.ampDecay = 900;
  Object.assign(patch.voices.bassline.custom, { accentSource: 1, accentFilter: 70, accentDecay: 40 });
  Object.assign(patch.voices.oh.custom, { chokeMode: 1, chokeRelease: 25 });
  Object.assign(patch.voices.lead.custom, { filterDecay: 200, subLevel: 35 });
  savePatch(patch);
  const restored = loadStoredPatch()!;
  for (const [id, fields] of Object.entries(additions)) {
    for (const key of Object.keys(fields)) expect(restored.voices[id as VoiceId].custom[key]).toBe(patch.voices[id as VoiceId].custom[key]);
  }
});

it("bounds added controls and uses defaults for malformed values", () => {
  expect(normalizeCustomVoiceSettings("snare", { toneDecay: 9999 }).toneDecay).toBe(600);
  expect(normalizeCustomVoiceSettings("clap", { burstDecay: -20 }).burstDecay).toBe(5);
  expect(normalizeCustomVoiceSettings("lead", { filterDecay: 237, subLevel: 999 })).toMatchObject({ filterDecay: 240, subLevel: 100 });
  for (const lowpass of [null, false, "", {}, NaN, Infinity]) {
    expect(normalizeCustomVoiceSettings("ch", { lowpass }).lowpass).toBe(20000);
  }
  expect(normalizeCustomVoiceSettings("ch", { lowpass: "4500" }).lowpass).toBe(4500);
  expect(normalizeCustomVoiceSettings("oh", { chokeMode: 99, chokeRelease: -20 })).toMatchObject({ chokeMode: 1, chokeRelease: 5 });
  expect(normalizeCustomVoiceSettings("bassline", { accentSource: -1, accentFilter: 900, accentDecay: -90 })).toMatchObject({ accentSource: 0, accentFilter: 100, accentDecay: 0 });
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
