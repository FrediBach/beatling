import { expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";
import { VOICE_DEFS } from "@/lib/constants";
import { VOICE_PARAMETER_SECTIONS } from "@/lib/voice-config";
import type { EffectiveBlock, VoiceId } from "@/lib/types";

// Record only the native Web Audio boundary; exercise the real voice dispatch,
// synthesis graph and scheduled envelopes without mocking synthesis helpers.
function parameter() {
  return { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}
function node() {
  return {
    type: "", loop: false, buffer: null, gain: parameter(), frequency: parameter(), Q: parameter(), playbackRate: parameter(),
    connect: vi.fn((target: unknown) => target), start: vi.fn(), stop: vi.fn(),
  };
}
function fixture(id: VoiceId, custom: Record<string, number> = {}) {
  const patch = createEmptyPatch();
  Object.assign(patch.voices[id], { machine: "custom", level: 100, decay: 46.875 }); // decay multiplier = 1
  Object.assign(patch.voices[id].custom, custom);
  const gains: ReturnType<typeof node>[] = [];
  const filters: ReturnType<typeof node>[] = [];
  const oscillators: ReturnType<typeof node>[] = [];
  const sources: ReturnType<typeof node>[] = [];
  const create = (nodes: ReturnType<typeof node>[]) => () => { const result = node(); nodes.push(result); return result; };
  const engine = new SequencerEngine(patch);
  Object.assign(engine, {
    context: { sampleRate: 32000, createGain: create(gains), createBiquadFilter: create(filters), createOscillator: create(oscillators), createBufferSource: create(sources) },
    noise: { duration: 2 },
    busses: new Map(VOICE_DEFS.map(({ id }) => [id, node()])),
  });
  const trigger = () => (engine as unknown as { playVoice: (id: VoiceId, time: number, modulation: EffectiveBlock) => void }).playVoice(id, 1, { steps: 16, pulses: 4, rot: 0, div: 1, prob: 100, tune: 0, decay: 0, level: 0 });
  return { patch, trigger, gains, filters, oscillators, sources };
}

it.each(VOICE_DEFS)("schedules finite, bounded $id voices at parameter extremes", ({ id }) => {
  for (const extreme of ["min", "max"] as const) {
    const custom = Object.fromEntries(VOICE_PARAMETER_SECTIONS[id].flatMap(({ parameters }) => parameters.map((p) => [p.key, p[extreme]])));
    const f = fixture(id, custom);
    f.patch.voices[id].tune = extreme === "max" ? 12 : -12;
    f.patch.voices[id].decay = extreme === "max" ? 100 : 0;
    f.trigger();
    for (const n of [...f.gains, ...f.filters, ...f.oscillators]) {
      for (const p of [n.gain, n.frequency, n.Q]) {
        for (const [value, time] of [...p.setValueAtTime.mock.calls, ...p.linearRampToValueAtTime.mock.calls, ...p.exponentialRampToValueAtTime.mock.calls]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(time).toBeGreaterThanOrEqual(1);
        }
        for (const [value] of p.exponentialRampToValueAtTime.mock.calls) expect(value).toBeGreaterThan(0);
      }
    }
    for (const source of [...f.sources, ...f.oscillators]) {
      expect(source.start).toHaveBeenCalledOnce();
      expect(source.stop).toHaveBeenCalledOnce();
      expect(source.stop.mock.calls[0][0]).toBeGreaterThan(source.start.mock.calls[0][0]);
      expect(source.stop.mock.calls[0][0]).toBeLessThan(12);
    }
    for (const filter of f.filters) {
      for (const [frequency] of [...filter.frequency.setValueAtTime.mock.calls, ...filter.frequency.exponentialRampToValueAtTime.mock.calls]) {
        expect(frequency).toBeLessThan(16000);
      }
    }
  }
});

it("keeps cymbal noise alive for its full envelope even beyond the noise buffer", () => {
  const f = fixture("cym", { duration: 4000 });
  f.trigger();
  expect(f.sources[0].loop).toBe(true);
  expect(f.sources[0].start.mock.calls[0]).toHaveLength(2);
  expect(f.sources[0].stop).toHaveBeenCalledWith(5.05);
});

it("finishes a short shaker after its attack, and allows a truly silent noise layer", () => {
  const f = fixture("shk", { attack: 40, duration: 15 });
  f.patch.voices.shk.decay = 0;
  f.trigger();
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 1.04);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.045);
  const silent = fixture("shk", { noiseLevel: 0 });
  silent.trigger();
  expect(silent.gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(silent.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
});

it("separates the snare shell decay from the noise tail", () => {
  const f = fixture("snare", { toneDecay: 500, noiseDecay: 100 });
  f.trigger();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.1);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.5);
  expect(f.oscillators[0].stop).toHaveBeenCalledWith(1.53);
});

it("gives each clap burst its own configured length without stretching the tail", () => {
  const f = fixture("clap", { burstCount: 2, burstSpacing: 20, burstDecay: 50, tailDecay: 200 });
  f.trigger();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.05);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.07);
  expect(f.gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.22);
});

it.each(["rim", "cow"] as const)("isolates the low or high %s partial without changing the centered mix", (id) => {
  for (const balance of [0, 50, 100]) {
    const f = fixture(id, { balance });
    f.trigger();
    const partialGains = f.oscillators.map((oscillator) => oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>);
    expect(partialGains[0].gain.setValueAtTime).toHaveBeenCalledWith(2 * (1 - balance / 100), 1);
    expect(partialGains[1].gain.setValueAtTime).toHaveBeenCalledWith(2 * balance / 100, 1);
  }
});

it.each(["ch", "oh", "cym"] as const)("filters both layers of %s and bypasses brightness at its legacy default", (id) => {
  const f = fixture(id, { lowpass: 6000 });
  f.trigger();
  const lowpass = f.filters.find((filter) => filter.type === "lowpass")!;
  expect(lowpass.frequency.setValueAtTime).toHaveBeenCalledWith(6000, 1);
  expect(f.gains.filter((gain) => gain.connect.mock.calls.some(([target]) => target === lowpass))).toHaveLength(2);
  const legacy = fixture(id);
  legacy.trigger();
  expect(legacy.filters.some((filter) => filter.type === "lowpass")).toBe(false);
});

it("adds kick harmonics only when requested", () => {
  const f = fixture("kick", { bodyTone: 50 });
  f.trigger();
  expect(f.oscillators.map(({ type }) => type)).toEqual(["sine", "triangle"]);
  const legacy = fixture("kick");
  legacy.trigger();
  expect(legacy.oscillators.map(({ type }) => type)).toEqual(["sine"]);
});

it.each(["lt", "mt", "ht"] as const)("adds a shorter shell mode to %s without retuning its fundamental", (id) => {
  const f = fixture(id, { overtoneLevel: 40 });
  f.trigger();
  expect(f.oscillators).toHaveLength(2);
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(f.patch.voices[id].custom.bodyFrequency * 1.5, 1);
  expect(f.oscillators[1].stop.mock.calls[0][0]).toBeLessThan(f.oscillators[0].stop.mock.calls[0][0]);
});

it("lets the bass sustain after its filter sweep, retaining linked envelopes at zero", () => {
  const f = fixture("bassline", { ampDecay: 1000, filterDecay: 100 });
  f.trigger();
  expect(f.filters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(700, 1.1);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 2);
  const linked = fixture("bassline", { ampDecay: 0, filterDecay: 100 });
  linked.trigger();
  expect(linked.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.1);
});

it("separates lead filter decay from release and adds an octave-down sub", () => {
  const f = fixture("lead", { filterDecay: 100, release: 1000, subLevel: 50, pulseMix: 0 });
  f.trigger();
  expect(f.filters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(3200, 1.1);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 2);
  expect(f.oscillators[1].type).toBe("sine");
  expect(f.oscillators[1].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0] / 2);
});

it("preserves low synth notes and sub pitches below 20 Hz", () => {
  const f = fixture("lead", { octave: 1, subLevel: 50, pulseMix: 0 });
  f.patch.voices.lead.tune = -12;
  f.trigger();
  expect(f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(16.3516, 3);
  expect(f.oscillators[1].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(8.1758, 3);
});
