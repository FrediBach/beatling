import { afterEach, expect, it } from "vitest";
import { VOICE_DEFS } from "./constants";
import { createEmptyPatch, loadStoredPatch, savePatch } from "./patch";
import { normalizeCustomVoiceSettings, VOICE_PARAMETER_SECTIONS } from "./voice-config";
import { applyVoicePreset, matchingVoicePreset, VOICE_PRESETS } from "./voice-presets";

afterEach(() => localStorage.clear());

it.each(VOICE_DEFS)("provides distinct, complete and persistable sounds for $name", ({ id }) => {
  const patch = createEmptyPatch();
  const original = patch.voices[id];
  const presets = VOICE_PRESETS[id];
  expect(presets).toHaveLength(4);
  expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
  expect(new Set(presets.map((preset) => JSON.stringify(preset.settings))).size).toBe(presets.length);
  expect(matchingVoicePreset(id, original.custom)?.id).toBe("default");
  for (const preset of presets) {
    const applied = applyVoicePreset(id, { ...original, machine: "custom" }, preset.id);
    expect(Object.keys(applied.custom).sort()).toEqual(VOICE_PARAMETER_SECTIONS[id].flatMap((section) => section.parameters.map(({ key }) => key)).sort());
    expect(normalizeCustomVoiceSettings(id, applied.custom)).toEqual(applied.custom);
    expect(matchingVoicePreset(id, applied.custom)?.id).toBe(preset.id);
    patch.voices[id] = applied;
    savePatch(patch);
    const restored = loadStoredPatch()!;
    expect(restored.voices[id]).toEqual(applied);
    expect(matchingVoicePreset(id, restored.voices[id].custom)?.id).toBe(preset.id);
  }
});

it("replaces the complete sound in one immutable update while retaining voice context", () => {
  const voice = createEmptyPatch().voices.kick;
  Object.assign(voice, { machine: "custom", tune: -5, decay: 81, level: 63, mute: true, solo: true, modulations: [{ source: "12", destination: "tune", amount: 0.5 }] });
  voice.custom.bodyAttack = 20;
  const before = structuredClone(voice);
  const applied = applyVoicePreset("kick", voice, "punch");
  expect(applied).toEqual({ ...before, custom: VOICE_PRESETS.kick.find(({ id }) => id === "punch")!.settings });
  expect(applied.custom.bodyAttack).toBe(0);
  expect(voice).toEqual(before);
  expect(applied.custom).not.toBe(voice.custom);
  expect(applied.custom).not.toBe(VOICE_PRESETS.kick[2].settings);
  expect(applyVoicePreset("kick", voice, "missing")).toBe(voice);
});

it.each(["bassline", "lead"] as const)("keeps the %s quantizer and matches sound independently of key, scale and octave", (id) => {
  const voice = createEmptyPatch().voices[id];
  Object.assign(voice.custom, { root: 7, scale: 5, octave: 3 });
  for (const preset of VOICE_PRESETS[id]) {
    const applied = applyVoicePreset(id, voice, preset.id);
    expect(applied.custom).toMatchObject({ root: 7, scale: 5, octave: 3 });
    expect(matchingVoicePreset(id, applied.custom)?.id).toBe(preset.id);
    applied.custom.cutoff += 100;
    expect(matchingVoicePreset(id, applied.custom)).toBeUndefined();
  }
});
