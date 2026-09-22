import { afterEach, expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";
import { generateMusicalPatch } from "@/lib/musical-randomizer/generate";
import { musicalEvents } from "@/lib/musical-randomizer/evaluate";
import { defaultRequest } from "@/lib/musical-randomizer/types";
import { effectiveVoiceModulation } from "@/lib/modulation";
import { quantizeVoiceCv } from "@/lib/quantizer";
import type { EffectiveBlock, Patch, VoiceId } from "@/lib/types";

interface EngineBoundary {
  tick: (time: number, pulse: number) => void;
  playVoice: (voice: VoiceId, time: number, effective: EffectiveBlock) => void;
  sourceLfo: (source: number, time: number) => number;
  initAudio: () => void;
  context: unknown;
  getPatch: () => Patch;
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it.each(["straight", "light", "strong"] as const)("matches the real engine's note onsets and quantized pitches with %s swing", (swing) => {
  const source = createEmptyPatch();
  const patch = generateMusicalPatch(source, { ...defaultRequest(source), profile: "broken", development: 2, swing }, 120).candidate!.patch;
  const engine = new SequencerEngine(patch);
  const boundary = engine as unknown as EngineBoundary;
  const actual: { voice: VoiceId; pulse: number; midi?: number }[] = [];
  let pulse = 0;
  vi.spyOn(boundary, "playVoice").mockImplementation((voice, time) => {
    const event: typeof actual[number] = { voice, pulse };
    if (voice === "bassline" || voice === "lead") {
      const state = patch.voices[voice];
      const cv = effectiveVoiceModulation(state, (source) => boundary.sourceLfo(source, time));
      event.midi = quantizeVoiceCv(state.custom, cv.vOct, state.tune).midi;
    }
    actual.push(event);
  });
  const interval = 60 / patch.bpm / patch.rate;
  try {
    for (pulse = 0; pulse < 128; pulse++) boundary.tick(0.08 + pulse * interval + (pulse % 2 ? patch.swing / 100 * interval * 0.5 : 0), pulse);
    const expected = musicalEvents(patch, 8).map(({ voice, pulse, midi }) => midi === undefined ? { voice, pulse } : { voice, pulse, midi });
    expect(actual).toEqual(expected);
  } finally { engine.destroy(); }
});

it("isolates audition from song callbacks and restores the latest committed patch", () => {
  const source = createEmptyPatch();
  const preview = generateMusicalPatch(source, defaultRequest(source), 21).candidate!.patch;
  const engine = new SequencerEngine(source);
  const boundary = engine as unknown as EngineBoundary;
  const advanceSong = vi.fn();
  engine.setBarCallback(advanceSong);
  engine.beginAudition(preview);
  expect(engine.auditioning).toBe(true);
  expect(boundary.getPatch()).toBe(preview);
  for (let pulse = 0; pulse < 65; pulse++) boundary.tick(pulse * 0.1, pulse);
  expect(advanceSong).not.toHaveBeenCalled();
  const latest = { ...source, bpm: 99 };
  engine.setPatch(latest);
  expect(engine.auditioning).toBe(false);
  expect(boundary.getPatch()).toBe(latest);
  expect(engine.running).toBe(false);
  engine.endAudition();
  expect(boundary.getPatch()).toBe(latest);
  for (let pulse = 0; pulse < 33; pulse++) boundary.tick(pulse * 0.1, pulse);
  expect(advanceSong).toHaveBeenCalled();
  engine.destroy();
});

it("does not restart audio after a pending resume is cancelled", async () => {
  vi.useFakeTimers();
  const engine = new SequencerEngine(createEmptyPatch());
  const boundary = engine as unknown as EngineBoundary;
  let resume!: () => void;
  boundary.context = { currentTime: 0, state: "suspended", resume: () => new Promise<void>((resolve) => { resume = resolve; }), close: vi.fn() };
  vi.spyOn(boundary, "initAudio").mockImplementation(() => undefined);
  const starting = engine.start();
  engine.stop();
  resume();
  await starting;
  expect(engine.running).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  engine.destroy();
});
