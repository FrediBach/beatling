import { expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";
import { VOICE_DEFS } from "@/lib/constants";
import { VOICE_PARAMETER_SECTIONS } from "@/lib/voice-config";
import type { EffectiveBlock, VoiceId } from "@/lib/types";

// Record only the native Web Audio boundary; exercise the real voice dispatch,
// synthesis graph and scheduled envelopes without mocking synthesis helpers.
function parameter() {
  return { value: 0, setValueAtTime: vi.fn(), setValueCurveAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}
function node() {
  return {
    type: "", loop: false, buffer: null, gain: parameter(), frequency: parameter(), Q: parameter(), playbackRate: parameter(),
    connect: vi.fn((target: unknown) => target), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), setPeriodicWave: vi.fn(),
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
  const context = { currentTime: 0, sampleRate: 32000, close: vi.fn(), createGain: create(gains), createBiquadFilter: create(filters), createOscillator: create(oscillators), createBufferSource: create(sources), createPeriodicWave: vi.fn((real: Float32Array, imag: Float32Array, constraints: PeriodicWaveConstraints) => ({ real, imag, constraints })) };
  Object.assign(engine, {
    context,
    noise: { duration: 2 },
    busses: new Map(VOICE_DEFS.map(({ id }) => [id, node()])),
  });
  const trigger = (voice = id, time = 1, modulation: Partial<EffectiveBlock> = {}) => (engine as unknown as { playVoice: (id: VoiceId, time: number, modulation: EffectiveBlock) => void }).playVoice(voice, time, { steps: 16, pulses: 4, rot: 0, div: 1, prob: 100, tune: 0, decay: 0, level: 0, ...modulation });
  return { patch, engine, context, trigger, gains, filters, oscillators, sources };
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
        for (const [curve, time, duration] of p.setValueCurveAtTime.mock.calls) {
          expect(curve).toHaveLength(1024);
          expect(Array.from(curve as Float32Array).every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
          expect(time).toBeGreaterThanOrEqual(1);
          expect(duration).toBeGreaterThan(0);
        }
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

it("adds a cymbal stick tick through brightness without changing the wash, metal or bell lengths", () => {
  const f = fixture("cym", { stickLevel: 40, stickFilter: 3000, stickDecay: 20, duration: 1200, metalDecay: 800, bellLevel: 30, bellDecay: 400, lowpass: 6500 });
  f.patch.voices.cym.tune = 12;
  f.patch.voices.cym.level = 50;
  f.patch.voices.cym.decay = 0;
  f.trigger("cym", 1, { tune: 1 }); // +24 semitones; quarter-length wash, metal and bell.
  expect(f.sources).toHaveLength(2);
  expect(f.oscillators).toHaveLength(9);
  const filter = f.sources[1].connect.mock.calls[0][0] as ReturnType<typeof node>;
  const gain = filter.connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(filter.type).toBe("bandpass");
  expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(6000, 1);
  expect(gain.connect).toHaveBeenCalledWith(f.filters.find(({ type }) => type === "lowpass"));
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.2, 1.001);
  expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.02);
  expect(gain.gain.linearRampToValueAtTime.mock.lastCall![0]).toBe(0);
  expect(gain.gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.025);
  expect(f.sources[1].stop).toHaveBeenCalledWith(1.07);
  expect(f.sources[0].stop.mock.calls[0][0]).toBeCloseTo(1.35);
  for (const oscillator of f.oscillators.filter(({ type }) => type === "square")) expect(oscillator.stop).toHaveBeenCalledWith(1.23);
  expect(f.oscillators.find(({ type }) => type === "sine")!.stop.mock.calls[0][0]).toBeCloseTo(1.13);
});

it("lets cymbal stick noise sound alone through the original voice bus", () => {
  const f = fixture("cym", { stickLevel: 50, noiseLevel: 0, metalLevel: 0, bellLevel: 0 });
  f.trigger();
  const stick = f.gains[2];
  for (const layer of f.gains.slice(0, 2)) expect(layer.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(stick.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 1.001);
  expect(stick.connect).toHaveBeenCalledWith(f.gains[0].connect.mock.calls[0][0]);
  expect(f.filters.some(({ type }) => type === "lowpass")).toBe(false);
});

it.each(["custom", "808", "909"] as const)("retains the original %s cymbal when stick noise is off or unsupported", (machine) => {
  const f = fixture("cym", { stickLevel: machine === "custom" ? 0 : 100, stickFilter: 12000, stickDecay: 120 });
  f.patch.voices.cym.machine = machine;
  f.trigger();
  expect(f.sources).toHaveLength(1);
  expect(f.gains).toHaveLength(2);
  expect(f.filters).toHaveLength(3);
  expect(f.oscillators).toHaveLength(6);
});

it.each([-1, 1])("keeps the cymbal stick short under Decay modulation %s and respects the filter ceiling", (decay) => {
  const f = fixture("cym", { stickLevel: 100, stickFilter: 12000, stickDecay: 10 });
  f.patch.voices.cym.tune = 12;
  f.patch.voices.cym.decay = decay < 0 ? 0 : 100;
  f.trigger("cym", 1, { tune: 1, decay });
  const filter = f.sources[1].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(15680, 1);
  expect(f.gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.01);
  expect(f.sources[1].stop).toHaveBeenCalledWith(1.06);
});

it("adds cymbal stick noise without consuming extra probability randomness, including at zero buffer offset", () => {
  const f = fixture("cym", { stickLevel: 100 });
  const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
  try {
    f.trigger("cym", 2);
    f.trigger("cym", 2.1);
    expect(random).toHaveBeenCalledTimes(2); // The original wash offset only.
    expect(f.sources[0].start).toHaveBeenCalledWith(2, 0.5);
    expect(f.sources[1].start).toHaveBeenCalledWith(2, 0);
    expect(f.sources[3].start.mock.calls[0][0]).toBe(2.1);
    expect(f.sources[3].start.mock.calls[0][1]).toBeCloseTo(0.1);
    expect(f.sources[1].loop).toBe(true);
  } finally {
    random.mockRestore();
  }
});

it("adds an independently pitched cymbal bell with faster-damping upper partials", () => {
  const f = fixture("cym", { bellLevel: 50, bellFrequency: 600, bellDecay: 800, duration: 100, metalDecay: 200, lowpass: 6000 });
  f.patch.voices.cym.tune = 12;
  f.patch.voices.cym.decay = 0; // quarter-length envelopes
  f.trigger();
  const bell = f.oscillators.filter(({ type }) => type === "sine");
  expect(bell).toHaveLength(3);
  expect(bell.map(({ frequency }) => frequency.setValueAtTime.mock.calls[0][0])).toEqual([1200, 2880, 4680]);
  const gains = bell.map((oscillator) => oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>);
  const brightness = f.filters.find(({ type }) => type === "lowpass")!;
  for (const gain of gains) expect(gain.connect).toHaveBeenCalledWith(brightness);
  expect(gains.reduce((sum, gain) => sum + gain.gain.linearRampToValueAtTime.mock.calls[0][0], 0)).toBeCloseTo(0.5);
  expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.2);
  expect(gains[1].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeLessThan(1.2);
  expect(gains[2].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeLessThan(gains[1].gain.exponentialRampToValueAtTime.mock.calls[0][1]);
  expect(bell[0].stop).toHaveBeenCalledWith(1.23);
  expect(f.sources[0].stop).toHaveBeenCalledWith(1.075);
  for (const oscillator of f.oscillators.filter(({ type }) => type === "square")) expect(oscillator.stop).toHaveBeenCalledWith(1.08);
});

it("lets the cymbal bell sound by itself before the dry/effect-send split", () => {
  const f = fixture("cym", { bellLevel: 40, metalLevel: 0, noiseLevel: 0 });
  f.trigger();
  const bus = f.gains[0].connect.mock.calls[0][0];
  for (const gain of f.gains.slice(0, 2)) expect(gain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  const bell = f.oscillators.filter(({ type }) => type === "sine");
  expect(bell).toHaveLength(3);
  for (const oscillator of bell) {
    const gain = oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>;
    expect(gain.connect).toHaveBeenCalledWith(bus);
    expect(gain.gain.linearRampToValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
  }
});

it.each(["custom", "808", "909"] as const)("preserves the original %s cymbal when the bell is off or unsupported", (machine) => {
  const f = fixture("cym", { bellLevel: machine === "custom" ? 0 : 100 });
  f.patch.voices.cym.machine = machine;
  f.trigger();
  expect(f.oscillators).toHaveLength(6);
  expect(f.oscillators.every(({ type }) => type === "square")).toBe(true);
  expect(f.gains).toHaveLength(2);
});

it("omits cymbal bell partials above the sample-rate ceiling instead of folding them together", () => {
  const f = fixture("cym", { bellLevel: 100, bellFrequency: 2000 });
  f.patch.voices.cym.tune = 12;
  f.trigger("cym", 1, { tune: 12 });
  const bell = f.oscillators.filter(({ type }) => type === "sine");
  expect(bell).toHaveLength(1);
  expect(bell[0].frequency.setValueAtTime).toHaveBeenCalledWith(8000, 1);
});

it("keeps short bell envelopes ordered under minimum Decay modulation", () => {
  const f = fixture("cym", { bellLevel: 100, bellDecay: 20 });
  f.patch.voices.cym.decay = 0;
  f.trigger("cym", 1, { decay: -1 });
  for (const oscillator of f.oscillators.filter(({ type }) => type === "sine")) {
    const gain = oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>;
    const peakTime = gain.gain.linearRampToValueAtTime.mock.calls[0][1];
    const endTime = gain.gain.exponentialRampToValueAtTime.mock.calls[0][1];
    expect(endTime).toBeGreaterThan(peakTime);
    expect(oscillator.stop.mock.calls[0][0]).toBeGreaterThan(endTime);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, endTime + 0.005);
  }
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

it("textures shaker noise before the amplitude envelope and effect bus", () => {
  const f = fixture("shk", { grainDepth: 75, grainRate: 80, duration: 200 });
  f.trigger();
  expect(f.sources).toHaveLength(1);
  expect(f.oscillators).toHaveLength(0);
  expect(f.gains).toHaveLength(2);
  const [envelope, texture] = f.gains;
  expect(f.sources[0].connect).toHaveBeenCalledWith(f.filters[0]);
  expect(f.filters[0].connect).toHaveBeenCalledWith(texture);
  expect(texture.connect).toHaveBeenCalledWith(envelope);
  expect(envelope.connect).toHaveBeenCalledOnce();
  expect(texture.gain.setValueCurveAtTime).toHaveBeenCalledOnce();
  const [curve, time, duration] = texture.gain.setValueCurveAtTime.mock.calls[0];
  expect(time).toBe(1);
  expect(duration).toBe(0.2);
  expect(Math.min(...curve)).toBeCloseTo(0.25);
  expect(Math.max(...curve)).toBeGreaterThan(0.9);
  // The curve owns a fresh parameter, with no overlapping automation events.
  expect(texture.gain.setValueAtTime).not.toHaveBeenCalled();
  expect(texture.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(texture.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(envelope.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.2);
  expect(f.sources[0].stop).toHaveBeenCalledWith(1.25);
});

it.each(["custom", "808", "909"] as const)("preserves the original %s shaker when texture is off or unsupported", (machine) => {
  const f = fixture("shk", { grainDepth: machine === "custom" ? 0 : 100, grainRate: 120 });
  f.patch.voices.shk.machine = machine;
  f.trigger();
  expect(f.gains).toHaveLength(1);
  expect(f.gains[0].gain.setValueCurveAtTime).not.toHaveBeenCalled();
  expect(f.filters[0].connect).toHaveBeenCalledWith(f.gains[0]);
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 1.006);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.075);
});

it("fits shaker texture to the attack-safe duration and skips silent texture", () => {
  const f = fixture("shk", { grainDepth: 100, attack: 40, duration: 15 });
  f.patch.voices.shk.decay = 0;
  f.trigger();
  expect(f.gains[1].gain.setValueCurveAtTime.mock.calls[0][2]).toBeCloseTo(0.045);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.045);
  expect(f.sources[0].stop.mock.calls[0][0]).toBeCloseTo(1.095);
  const silent = fixture("shk", { grainDepth: 100, noiseLevel: 0 });
  silent.trigger();
  expect(silent.gains).toHaveLength(1);
  expect(silent.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
});

it("varies shaker grains per hit without consuming additional rhythm randomness", () => {
  const f = fixture("shk", { grainDepth: 100 });
  const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
  try {
    f.trigger();
    f.trigger("shk", 1.1);
    expect(random).toHaveBeenCalledTimes(2); // One noise-buffer offset per hit.
    expect(f.gains[1].gain.setValueCurveAtTime.mock.calls[0][0]).not.toEqual(f.gains[3].gain.setValueCurveAtTime.mock.calls[0][0]);
  } finally {
    random.mockRestore();
  }
});

it("separates the snare shell decay from the noise tail", () => {
  const f = fixture("snare", { toneDecay: 500, noiseDecay: 100 });
  f.trigger();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.1);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.5);
  expect(f.oscillators[0].stop).toHaveBeenCalledWith(1.53);
});

it("sweeps both snare shell modes together without changing their spread or amplitude lengths", () => {
  const f = fixture("snare", { pitchAmount: 2, pitchDecay: 30, toneFrequency: 200, toneSpread: 1.5, toneDecay: 400, noiseDecay: 100 });
  f.patch.voices.snare.tune = 12;
  f.patch.voices.snare.decay = 0; // quarter-length amplitude, fixed pitch-decay time
  f.trigger();
  expect(f.oscillators[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(800, 1);
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenLastCalledWith(1200, 1);
  expect(f.oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(400, 1.03);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(600, 1.03);
  for (const oscillator of f.oscillators) expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(1.13);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.1);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.025);
});

it("gives snare noise its own attack while the shell begins immediately", () => {
  const f = fixture("snare", { noiseAttack: 20, noiseDecay: 300, toneDecay: 100, noiseLevel: 60, toneLevel: 40 });
  f.patch.voices.snare.level = 50;
  f.trigger();
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.3, 1.02);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.3);
  expect(f.gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, 1);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.1);
  expect(f.sources[0].stop).toHaveBeenCalledWith(1.35);
});

it("finishes long snare attacks at minimum Decay without extending the shell", () => {
  const f = fixture("snare", { noiseAttack: 40, noiseDecay: 40, toneDecay: 30 });
  f.patch.voices.snare.decay = 0;
  f.trigger("snare", 1, { decay: -1 });
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.8, 1.04);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.045);
  expect(f.gains[0].gain.linearRampToValueAtTime.mock.lastCall![0]).toBe(0);
  expect(f.gains[0].gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.05);
  expect(f.sources[0].stop.mock.calls[0][0]).toBeCloseTo(1.095);
  expect(f.oscillators[0].stop.mock.calls[0][0]).toBeCloseTo(1.0345);
});

it.each(["custom", "808", "909"] as const)("retains the original %s snare with shaping disabled or unsupported", (machine) => {
  const f = fixture("snare", { pitchAmount: machine === "custom" ? 1 : 4, pitchDecay: 150, noiseAttack: machine === "custom" ? 0 : 40 });
  f.patch.voices.snare.machine = machine;
  f.trigger();
  for (const oscillator of f.oscillators) expect(oscillator.frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0.8, 1);
  expect(f.gains[0].gain.linearRampToValueAtTime.mock.calls).toHaveLength(1); // Final silence, no attack.
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1 + (machine === "custom" ? 0.26 : machine === "909" ? 0.28 : 0.2));
});

it("keeps a snare layer silent at zero level with pitch sweep and noise attack enabled", () => {
  for (const mutedLayer of ["toneLevel", "noiseLevel"]) {
    const f = fixture("snare", { pitchAmount: 4, noiseAttack: 40, [mutedLayer]: 0 });
    f.trigger();
    const silentGains = mutedLayer === "toneLevel" ? f.gains.slice(1) : [f.gains[0]];
    for (const gain of silentGains) {
      expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
      expect(gain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
      expect(gain.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    }
  }
});

it("gives each clap burst its own configured length without stretching the tail", () => {
  const f = fixture("clap", { burstCount: 2, burstSpacing: 20, burstDecay: 50, tailDecay: 200 });
  f.trigger();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.05);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.07);
  expect(f.gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.22);
});

it("gives the clap tail its own filter and fade-in without changing the bursts", () => {
  const f = fixture("clap", { burstCount: 3, burstSpacing: 20, burstDecay: 15, filterFrequency: 2000, filterQ: 2, tailFilter: 800, tailAttack: 30, tailDecay: 300, tailLevel: 40 });
  f.patch.voices.clap.tune = 12;
  f.trigger("clap", 1, { tune: 1 }); // Combined +24 semitones doubles clap filter frequencies.
  expect(f.filters).toHaveLength(2);
  expect(f.sources).toHaveLength(4);
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(4000, 1);
  expect(f.filters[1].frequency.setValueAtTime).toHaveBeenCalledWith(1600, 1.04);
  expect(f.filters[1].Q.setValueAtTime).toHaveBeenCalledWith(2, 1.04);
  expect(f.filters[1].connect).toHaveBeenCalledWith(f.filters[0].connect.mock.calls[0][0]);
  for (let i = 0; i < 3; i++) {
    expect(f.gains[i].connect).toHaveBeenCalledWith(f.filters[0]);
    expect(f.gains[i].gain.setValueAtTime).toHaveBeenLastCalledWith(0.55, 1 + i * 0.02);
    expect(f.gains[i].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.015 + i * 0.02);
  }
  const tail = f.gains[3];
  expect(tail.connect).toHaveBeenCalledWith(f.filters[1]);
  expect(tail.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1.04);
  expect(tail.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4, 1.07);
  expect(tail.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.34);
  expect(f.sources[3].start.mock.calls[0][0]).toBe(1.04);
  expect(f.sources[3].stop.mock.calls[0][0]).toBeCloseTo(1.39);
});

it.each(["custom", "808", "909"] as const)("preserves the original %s clap with tail shaping disabled or unsupported", (machine) => {
  const f = fixture("clap", { tailFilter: machine === "custom" ? 0 : 12000, tailAttack: machine === "custom" ? 0 : 80 });
  f.patch.voices.clap.machine = machine;
  f.trigger();
  const start = machine === "custom" ? 1.022 : machine === "808" ? 1.026 : 1.018;
  expect(f.filters).toHaveLength(1);
  for (const gain of f.gains) expect(gain.connect).toHaveBeenCalledWith(f.filters[0]);
  expect(f.gains[3].gain.setValueAtTime).toHaveBeenLastCalledWith(0.5, start);
  expect(f.gains[3].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, start + 0.22);
  expect(f.gains[3].gain.linearRampToValueAtTime).toHaveBeenCalledOnce(); // Final silence only.
});

it("supports clap tail attack with a linked filter and a separate filter with zero attack", () => {
  const linked = fixture("clap", { tailAttack: 20, tailFilter: 0 });
  linked.trigger();
  expect(linked.filters).toHaveLength(1);
  expect(linked.gains[3].connect).toHaveBeenCalledWith(linked.filters[0]);
  expect(linked.gains[3].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 1.042);
  const immediate = fixture("clap", { tailAttack: 0, tailFilter: 600 });
  immediate.trigger();
  expect(immediate.filters).toHaveLength(2);
  expect(immediate.gains[3].gain.setValueAtTime).toHaveBeenLastCalledWith(0.5, 1.022);
  expect(immediate.gains[3].gain.linearRampToValueAtTime).toHaveBeenCalledOnce();
});

it("extends a short clap tail to finish its attack after the last burst", () => {
  const f = fixture("clap", { burstCount: 6, burstSpacing: 30, tailAttack: 80, tailDecay: 40 });
  f.patch.voices.clap.decay = 0;
  f.trigger("clap", 1, { decay: -1 });
  const tail = f.gains[6];
  expect(tail.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1.15);
  expect(tail.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 1.23);
  expect(tail.gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.235);
  expect(tail.gain.linearRampToValueAtTime.mock.lastCall![0]).toBe(0);
  expect(tail.gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.24);
  expect(f.sources[6].stop.mock.calls[0][0]).toBeCloseTo(1.285);
});

it("keeps clap attack time fixed under Decay modulation and bounds the tail filter", () => {
  const f = fixture("clap", { burstCount: 1, tailAttack: 40, tailDecay: 1000, tailFilter: 12000 });
  f.patch.voices.clap.decay = 100;
  f.patch.voices.clap.tune = 12;
  f.trigger("clap", 1, { decay: 1, tune: 1 });
  expect(f.filters[1].frequency.setValueAtTime).toHaveBeenCalledWith(15680, 1);
  expect(f.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 1.04);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 3.4);
  expect(f.sources[1].stop.mock.calls[0][0]).toBeCloseTo(3.45);
});

it.each(["burstLevel", "tailLevel"])("keeps zero clap %s silent with tail shaping enabled", (silentLayer) => {
  const f = fixture("clap", { [silentLayer]: 0, tailAttack: 30, tailFilter: 700 });
  f.trigger();
  const silent = silentLayer === "burstLevel" ? f.gains.slice(0, 3) : [f.gains[3]];
  for (const gain of silent) {
    expect(gain.gain.setValueAtTime.mock.lastCall![0]).toBe(0);
    expect(gain.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(gain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  }
  const audible = silentLayer === "burstLevel" ? f.gains[3] : f.gains[0];
  expect(audible.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
  expect(f.filters).toHaveLength(silentLayer === "tailLevel" ? 1 : 2);
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

it("damps only the cowbell's high oscillator ahead of its shared filter and envelope", () => {
  const f = fixture("cow", { highDamping: 100, balance: 75, duration: 400 });
  f.trigger();
  expect(f.oscillators).toHaveLength(2);
  expect(f.gains).toHaveLength(3);
  expect(f.filters).toHaveLength(1);
  const [envelope, low, high] = f.gains;
  expect(low.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 1);
  expect(low.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(high.gain.setValueAtTime).toHaveBeenCalledWith(1.5, 1);
  expect(high.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0015, 1.4);
  expect(low.connect).toHaveBeenCalledWith(f.filters[0]);
  expect(high.connect).toHaveBeenCalledWith(f.filters[0]);
  expect(f.filters[0].connect).toHaveBeenCalledWith(envelope);
  expect(envelope.connect).toHaveBeenCalledOnce();
  expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.55, 1.003);
  expect(envelope.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.4);
  for (const oscillator of f.oscillators) expect(oscillator.stop).toHaveBeenCalledWith(1.43);
});

it("increases cowbell damping gradually from zero without a jump in decay strength", () => {
  const targets = [1, 25, 50, 100].map((highDamping) => {
    const f = fixture("cow", { highDamping });
    f.trigger();
    return f.gains[2].gain.exponentialRampToValueAtTime.mock.calls[0][0] as number;
  });
  expect(targets[0]).toBeGreaterThan(0.93); // Near-unity endpoint at 1%.
  expect(targets[0]).toBeLessThan(1);
  expect(targets[1]).toBeCloseTo(0.177828, 5); // Additional 15 dB loss.
  expect(targets[2]).toBeCloseTo(0.031623, 5); // Additional 30 dB loss.
  expect(targets[3]).toBeCloseTo(0.001); // Additional 60 dB loss.
});

it.each(["custom", "808", "909"] as const)("preserves the %s cowbell's original partial gains when damping is off or unsupported", (machine) => {
  const f = fixture("cow", { highDamping: machine === "custom" ? 0 : 100 });
  f.patch.voices.cow.machine = machine;
  f.trigger();
  for (const partial of f.gains.slice(1)) {
    expect(partial.gain.setValueAtTime).toHaveBeenCalledWith(1, 1);
    expect(partial.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  }
  expect(f.gains[0].gain.exponentialRampToValueAtTime.mock.calls[0][0]).toBe(0.0001);
  expect(f.gains[0].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.36);
});

it("scales cowbell damping with Decay without retuning either oscillator", () => {
  const f = fixture("cow", { highDamping: 100, duration: 1000 });
  f.patch.voices.cow.tune = 12;
  f.patch.voices.cow.decay = 100;
  f.trigger("cow", 1, { decay: 1 }); // Maximum combined length multiplier = 2.4.
  expect(f.gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 3.4);
  expect(f.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(1080, 1);
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(1600, 1);
  for (const oscillator of f.oscillators) expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(3.43);
});

it("keeps zero cowbell layers silent with damping enabled", () => {
  const lowOnly = fixture("cow", { highDamping: 100, balance: 0 });
  lowOnly.trigger();
  expect(lowOnly.gains[2].gain.setValueAtTime).toHaveBeenCalledWith(0, 1);
  expect(lowOnly.gains[2].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  const highOnly = fixture("cow", { highDamping: 100, balance: 100 });
  highOnly.trigger();
  expect(highOnly.gains[1].gain.setValueAtTime).toHaveBeenCalledWith(0, 1);
  expect(highOnly.gains[2].gain.exponentialRampToValueAtTime.mock.calls[0][0]).toBe(0.002);
  expect(highOnly.gains[2].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.36);
  const silent = fixture("cow", { highDamping: 100, toneLevel: 0 });
  silent.trigger();
  expect(silent.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(silent.gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(silent.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
});

it("bounds cowbell damping at the shortest modulated length", () => {
  const f = fixture("cow", { highDamping: 100, duration: 40 });
  f.patch.voices.cow.decay = 0;
  f.trigger("cow", 1, { decay: -1 });
  expect(f.gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 1.01);
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1.013);
  for (const oscillator of f.oscillators) expect(oscillator.stop.mock.calls[0][0]).toBeGreaterThan(1.013);
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

it.each(["ch", "oh", "cym"] as const)("shapes only the %s metallic bank with independent focus and resonance", (id) => {
  const f = fixture(id, { metalFocus: 4500, metalQ: 3.2, highpass: 2500, noiseHighpass: 7000, lowpass: 8000, metalDecay: 200, duration: 300 });
  f.patch.voices[id].tune = 12;
  f.trigger();
  expect(f.oscillators).toHaveLength(6);
  expect(f.gains).toHaveLength(2);
  expect(f.filters).toHaveLength(4);
  const hp = f.oscillators[0].connect.mock.calls[0][0] as ReturnType<typeof node>;
  const focus = hp.connect.mock.calls[0][0] as ReturnType<typeof node>;
  const metal = focus.connect.mock.calls[0][0] as ReturnType<typeof node>;
  const brightness = f.filters.find(({ type }) => type === "lowpass")!;
  for (const oscillator of f.oscillators) expect(oscillator.connect).toHaveBeenCalledWith(hp);
  expect(hp.frequency.setValueAtTime).toHaveBeenCalledWith(2500, 1);
  expect(focus.type).toBe("bandpass");
  expect(focus.frequency.setValueAtTime).toHaveBeenCalledWith(4500, 1); // Tune changes source pitch, not focus.
  expect(focus.Q.setValueAtTime).toHaveBeenCalledWith(3.2, 1);
  expect(metal.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.2);
  expect(metal.connect).toHaveBeenCalledWith(brightness);
  const noiseFilter = f.sources[0].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(noiseFilter).not.toBe(focus);
  const noise = noiseFilter.connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(noiseFilter.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(id === "cym" ? 7000 : 9899.49494);
  expect(noise.connect).toHaveBeenCalledWith(brightness);
  expect(noise.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.3);
  for (const oscillator of f.oscillators) expect(oscillator.stop).toHaveBeenCalledWith(1.23);
});

it.each(["ch", "oh", "cym"] as const)("retains the original %s metal filters by default and in 808/909 models", (id) => {
  for (const machine of ["custom", "808", "909"] as const) {
    const f = fixture(id, machine === "custom" ? {} : { metalFocus: 2000, metalQ: 8 });
    f.patch.voices[id].machine = machine;
    f.trigger();
    const filter = f.filters.find(({ type }) => type === "bandpass")!;
    expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(9000, 1);
    expect(filter.Q.setValueAtTime).toHaveBeenCalledWith(0.9, 1);
  }
});

it.each(["ch", "oh", "cym"] as const)("bounds %s metal focus to the active sample rate and keeps silent metal silent", (id) => {
  const f = fixture(id, { metalFocus: 14000, metalQ: 8, metalLevel: 0 });
  f.context.sampleRate = 22050;
  f.trigger();
  const filter = f.filters.find(({ type }) => type === "bandpass")!;
  const gain = filter.connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(10804.5, 1);
  expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(gain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.sources).toHaveLength(1);
});

it("keeps cymbal bell and stick paths outside the metal focus filter", () => {
  const f = fixture("cym", { metalFocus: 3000, metalQ: 5, bellLevel: 40, stickLevel: 30, stickFilter: 6000, lowpass: 7000 });
  f.trigger();
  const brightness = f.filters.find(({ type }) => type === "lowpass")!;
  for (const oscillator of f.oscillators.filter(({ type }) => type === "sine")) {
    const gain = oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>;
    expect(gain.connect).toHaveBeenCalledWith(brightness);
  }
  const stickFilter = f.sources[1].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(stickFilter.frequency.setValueAtTime).toHaveBeenCalledWith(6000, 1);
  expect(stickFilter.Q.setValueAtTime).toHaveBeenCalledWith(0.7, 1);
  const stick = stickFilter.connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(stick.connect).toHaveBeenCalledWith(brightness);
});

it("lets independent rim noise outlast a silent tone layer, with matching filter tuning", () => {
  const f = fixture("rim", { noiseMode: 1, noiseDecay: 180, duration: 20, toneLevel: 0, noiseLevel: 40, filterFrequency: 2000, filterQ: 2 });
  f.patch.voices.rim.decay = 0; // 0.25 multiplier
  f.patch.voices.rim.tune = 12;
  f.trigger();
  const noiseGain = f.sources[0].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(noiseGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.4, 1);
  expect(noiseGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.045);
  expect(f.sources[0].stop.mock.calls[0][0]).toBeCloseTo(1.095);
  expect(f.filters).toHaveLength(2);
  for (const filter of f.filters) {
    expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(4000, 1);
    expect(filter.Q.setValueAtTime).toHaveBeenCalledWith(2, 1);
  }
  expect(noiseGain.connect).toHaveBeenCalledWith(f.filters[1]);
  expect(f.filters[0].connect).toHaveBeenCalledWith(f.gains[0]);
  expect(f.filters[1].connect.mock.calls[0][0]).toBe(f.gains[0].connect.mock.calls[0][0]);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
});

it.each([
  [4500, 0.8, 9000, 0.8],
  [0, 0.8, 4000, 0.8],
  [4500, 0, 9000, 2],
])("shapes rim noise with filter %s and resonance %s independently of the body", (noiseFilter, noiseQ, frequency, q) => {
  const f = fixture("rim", { noiseMode: 1, noiseFilter, noiseQ, noiseDecay: 180, duration: 20, noiseLevel: 40, filterFrequency: 2000, filterQ: 2 });
  f.patch.voices.rim.tune = 7;
  f.patch.voices.rim.decay = 0;
  f.patch.voices.rim.level = 50;
  f.trigger("rim", 1, { tune: 5 / 12 }); // One octave of combined Tune, quarter-length envelopes.
  expect(f.filters).toHaveLength(2);
  expect(f.gains).toHaveLength(4);
  expect(f.oscillators).toHaveLength(2);
  expect(f.sources).toHaveLength(1);
  const [body, noise] = f.filters;
  expect(body.frequency.setValueAtTime).toHaveBeenCalledWith(4000, 1);
  expect(body.Q.setValueAtTime).toHaveBeenCalledWith(2, 1);
  expect(noise.type).toBe("bandpass");
  expect(noise.frequency.setValueAtTime).toHaveBeenCalledWith(frequency, 1);
  expect(noise.Q.setValueAtTime).toHaveBeenCalledWith(q, 1);
  expect(f.gains[3].gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, 1);
  expect(f.gains[3].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.045);
  expect(f.gains[3].connect).toHaveBeenCalledWith(noise);
  expect(noise.connect.mock.calls[0][0]).toBe(f.gains[0].connect.mock.calls[0][0]);
  expect(f.sources[0].stop.mock.calls[0][0]).toBeCloseTo(1.095);
  expect(f.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(3340, 1);
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(4700, 1);
  for (const oscillator of f.oscillators) {
    const partial = oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>;
    expect(partial.connect).toHaveBeenCalledWith(body);
    expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(1.02);
  }
});

it("bounds the independent rim noise filter below Nyquist under high Tune", () => {
  const f = fixture("rim", { noiseMode: 1, noiseFilter: 12000, noiseQ: 12 });
  f.context.sampleRate = 22050;
  f.patch.voices.rim.tune = 12;
  f.trigger("rim", 1, { tune: 1 });
  expect(f.filters[1].frequency.setValueAtTime).toHaveBeenCalledWith(10804.5, 1);
  expect(f.filters[1].Q.setValueAtTime).toHaveBeenCalledWith(12, 1);
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(7000, 1);
});

it("keeps filtered rim noise audible with a silent body", () => {
  const f = fixture("rim", { noiseMode: 1, noiseFilter: 4500, noiseQ: 0.8, toneLevel: 0, noiseLevel: 40 });
  f.trigger();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[3].gain.setValueAtTime).toHaveBeenLastCalledWith(0.4, 1);
  expect(f.filters[1].connect.mock.calls[0][0]).toBe(f.gains[0].connect.mock.calls[0][0]);
});

it("keeps independent rim noise silent at zero Noise level without muting its tone", () => {
  const f = fixture("rim", { noiseMode: 1, noiseLevel: 0, toneLevel: 70, noiseFilter: 4500, noiseQ: 0.8 });
  f.trigger();
  const noiseGain = f.sources[0].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(noiseGain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(noiseGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0.7, 1);
});

it.each(["custom", "808", "909"] as const)("preserves the original linked rim graph for %s", (machine) => {
  const f = fixture("rim", { noiseMode: machine === "custom" ? 0 : 1, noiseDecay: 180, noiseFilter: 4500, noiseQ: 0.8 });
  f.patch.voices.rim.machine = machine;
  f.trigger();
  expect(f.filters).toHaveLength(1);
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(1750, 1);
  expect(f.filters[0].Q.setValueAtTime).toHaveBeenCalledWith(3.5, 1);
  const noiseGain = f.sources[0].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(noiseGain.connect).toHaveBeenCalledWith(f.filters[0]);
  expect(f.filters[0].connect).toHaveBeenCalledWith(f.gains[0]);
  expect(noiseGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.02);
  expect(f.sources[0].stop).toHaveBeenCalledWith(1.07);
});

it.each(["ch", "oh", "cym"] as const)("gives %s independent metal and noise lengths that both follow Decay", (id) => {
  for (const metalDecay of [50, 0, 300]) {
    for (const decay of [0, 46.875, 100]) {
      const f = fixture(id, { duration: 200, metalDecay });
      f.patch.voices[id].decay = decay;
      const multiplier = 0.25 + decay / 100 * 1.6;
      const metalDuration = (metalDecay || 200) / 1000 * multiplier;
      f.trigger();
      const metalGain = f.gains[id === "cym" ? 0 : 1];
      const noiseGain = f.gains[id === "cym" ? 1 : 0];
      expect(metalGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1 + metalDuration);
      expect(noiseGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1 + 0.2 * multiplier);
      for (const oscillator of f.oscillators) expect(oscillator.stop).toHaveBeenCalledWith(1 + metalDuration + 0.03);
      expect(f.sources[0].stop).toHaveBeenCalledWith(1 + 0.2 * multiplier + 0.05);
    }
  }
});

it.each(["ch", "oh", "cym"] as const)("ignores custom metal length in the 808/909 %s circuits", (id) => {
  for (const machine of ["808", "909"] as const) {
    const f = fixture(id, { metalDecay: 10 });
    f.patch.voices[id].machine = machine;
    f.trigger();
    const duration = id === "cym" ? machine === "909" ? 1.6 : 1.15 : id === "oh" ? 0.42 : 0.058;
    const metalDuration = id !== "cym" && machine === "909" ? duration * 0.7 : duration;
    for (const oscillator of f.oscillators) expect(oscillator.stop).toHaveBeenCalledWith(1 + metalDuration + 0.03);
  }
});

it.each([[80, 1000], [1000, 80]])("keeps open-hat choking active through noise %i ms and metal %i ms", (duration, metalDecay) => {
  const f = fixture("oh", { chokeMode: 1, chokeRelease: 20, duration, metalDecay, metalFocus: 4500, metalQ: 3 });
  f.trigger();
  const gate = f.gains[0];
  f.context.currentTime = 1.3;
  f.trigger("oh", 1.3); // Reclaims expired gates using the actual audio clock.
  expect(gate.disconnect).not.toHaveBeenCalled();
  f.trigger("ch", 1.4);
  expect(gate.gain.cancelScheduledValues).toHaveBeenCalledWith(1.4);
  expect(gate.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.42);
});

it("shapes both kick body oscillators independently of the click and pitch sweep", () => {
  const f = fixture("kick", { bodyLevel: 60, bodyAttack: 8, bodyTone: 40, bodyDecay: 400, bodyFrequency: 60, pitchAmount: 4, pitchDecay: 30, clickLevel: 50, clickDecay: 20 });
  f.patch.voices.kick.level = 50;
  f.patch.voices.kick.tune = 12;
  f.trigger("kick", 1, { level: 0.5 }); // Effective amplitude 0.65.
  expect(f.gains).toHaveLength(4);
  expect(f.filters).toHaveLength(1);
  expect(f.oscillators.map(({ type }) => type)).toEqual(["sine", "triangle"]);
  const body = f.gains[0];
  expect(body.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(body.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.39, 1.008);
  expect(body.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.4);
  expect(body.gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.405);
  for (const oscillator of f.oscillators) {
    const blend = oscillator.connect.mock.calls[0][0] as ReturnType<typeof node>;
    expect(blend.connect).toHaveBeenCalledWith(body);
    expect(oscillator.frequency.setValueAtTime).toHaveBeenLastCalledWith(480, 1);
    expect(oscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(120, 1.03);
    expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(1.45);
  }
  const click = f.gains[3];
  expect(click.gain.setValueAtTime).toHaveBeenLastCalledWith(0.325, 1);
  expect(click.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.02);
  expect(click.connect).toHaveBeenCalledWith(body.connect.mock.calls[0][0]);
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(1800, 1);
  expect(f.sources[0].stop).toHaveBeenCalledWith(1.07);
});

it.each([0, 30])("silences the kick body independently with %s ms attack", (bodyAttack) => {
  const f = fixture("kick", { bodyLevel: 0, bodyAttack, bodyTone: 50, clickLevel: 70 });
  f.trigger();
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(f.gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[3].gain.setValueAtTime).toHaveBeenLastCalledWith(0.7, 1);
});

it.each([-1, 1])("keeps kick attack fixed under Decay modulation %s and completes short envelopes", (decay) => {
  const f = fixture("kick", { bodyAttack: 30, bodyDecay: 80, clickLevel: 0 });
  f.patch.voices.kick.decay = decay < 0 ? 0 : 100;
  f.trigger("kick", 1, { decay });
  const duration = decay < 0 ? 0.035 : 0.08 * 2.4;
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 1.03);
  expect(f.gains[0].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1 + duration);
  expect(f.gains[0].gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1 + duration + 0.005);
  expect(f.oscillators[0].stop.mock.calls[0][0]).toBeCloseTo(1 + duration + 0.05);
  expect(f.gains[2].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.sources[0].stop.mock.calls[0][0]).toBeCloseTo(1.066);
});

it.each(["custom", "808", "909"] as const)("retains the original %s kick envelope at defaults or unsupported settings", (machine) => {
  const f = fixture("kick", machine === "custom" ? {} : { bodyLevel: 0, bodyAttack: 30 });
  f.patch.voices.kick.machine = machine;
  f.trigger();
  expect(f.oscillators).toHaveLength(1);
  expect(f.gains).toHaveLength(3);
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(1, 1);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1 + (machine === "custom" ? 0.62 : machine === "909" ? 0.42 : 0.85));
  expect(f.gains[0].gain.linearRampToValueAtTime.mock.calls.map(([value]) => value)).toEqual([0]);
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
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1 + 0.45 * 0.45);
  expect(f.oscillators[1].stop).toHaveBeenCalledWith(1 + 0.45 * 0.45 + 0.03);
});

it.each(["lt", "mt", "ht"] as const)("tunes the %s shell and lets it ring beyond the body through the same voice bus", (id) => {
  const f = fixture(id, { bodyFrequency: 100, pitchAmount: 3, pitchDecay: 80, duration: 200, overtoneLevel: 60, overtoneRatio: 2.25, overtoneDecay: 800 });
  f.patch.voices[id].tune = 7;
  f.patch.voices[id].decay = 0;
  f.trigger(id, 1, { tune: 5 / 12 }); // Combined Tune = one octave; Decay = quarter length.
  expect(f.oscillators[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(600, 1);
  expect(f.oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(200, 1.08);
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(450, 1);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.05);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.2);
  expect(f.oscillators[1].stop).toHaveBeenCalledWith(1.23);
  expect(f.gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0.6 * 0.45, 1);
  expect(f.gains[1].connect).toHaveBeenCalledWith(f.gains[0].connect.mock.calls[0][0]);
  expect(f.sources[0].stop).toHaveBeenCalledWith(1.09); // Stick transient stays independent.
});

it.each(["lt", "mt", "ht"] as const)("keeps %s shell damping linked at zero and supports a short independent knock", (id) => {
  for (const [length, end] of [[0, 1.70875], [80, 1.084]]) {
    const f = fixture(id, { duration: 1500, overtoneLevel: 50, overtoneDecay: length });
    f.patch.voices[id].decay = 0;
    f.trigger(id, 1, { decay: 1 }); // Multiplier = 1.05, including routed Decay.
    expect(f.gains[1].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(end);
    expect(f.oscillators[1].stop.mock.calls[0][0]).toBeCloseTo(end + 0.03);
    expect(f.gains[0].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(2.575);
  }
});

it.each(["lt", "mt", "ht"] as const)("preserves %s model bypass and silent overtone settings", (id) => {
  for (const machine of ["custom", "808", "909"] as const) {
    const f = fixture(id, { overtoneLevel: machine === "custom" ? 0 : 100, overtoneRatio: 4, overtoneDecay: 1500 });
    f.patch.voices[id].machine = machine;
    f.trigger();
    expect(f.oscillators).toHaveLength(1);
    expect(f.gains).toHaveLength(2);
    expect(f.sources).toHaveLength(1);
  }
});

it("allows an isolated tom shell and bounds very short envelopes", () => {
  const f = fixture("lt", { bodyLevel: 0, noiseLevel: 0, overtoneLevel: 100, overtoneDecay: 5 });
  f.patch.voices.lt.decay = 0;
  f.trigger("lt", 1, { decay: -1 });
  expect(f.gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[2].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0.45, 1);
  expect(f.gains[1].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.01);
  expect(f.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.015);
  expect(f.oscillators[1].stop.mock.calls[0][0]).toBeGreaterThan(1.015);
});

it("omits a tom overtone above the sample-rate ceiling while retaining body and noise", () => {
  const f = fixture("ht", { bodyFrequency: 320, pitchAmount: 1, overtoneLevel: 100, overtoneRatio: 4 });
  f.context.sampleRate = 8000;
  f.patch.voices.ht.tune = 12;
  f.trigger("ht", 1, { tune: 1 });
  expect(f.oscillators).toHaveLength(1);
  expect(f.oscillators[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(1280, 1);
  expect(f.sources).toHaveLength(1);
  expect(f.gains).toHaveLength(2);
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

it.each(["808", "909", "custom"] as const)("chokes both layers of the %s open hat before its effect sends", (machine) => {
  const f = fixture("oh", { chokeMode: 1, chokeRelease: 30, lowpass: 6000 });
  f.patch.voices.oh.machine = machine;
  f.trigger();
  const gate = f.gains[0];
  const destination = machine === "custom" ? f.filters.find((filter) => filter.type === "lowpass")! : gate;
  const layers = f.gains.filter((gain) => gain.connect.mock.calls.some(([target]) => target === destination));
  expect(layers).toHaveLength(machine === "808" ? 1 : 2);
  if (machine === "custom") expect(destination.connect).toHaveBeenCalledWith(gate);
  f.trigger("ch", 1.1);
  expect(gate.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 1.1);
  expect(gate.gain.linearRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.13);
});

it.each([false, true])("lets the closed hat win simultaneous routed hits (closed first: %s)", (closedFirst) => {
  const f = fixture("oh", { chokeMode: 1 });
  // Exercise actual routing and traversal order, including the Bernoulli path.
  Object.assign(f.patch.blocks[0], { kind: "voice", voice: closedFirst ? "ch" : "oh", steps: 1, pulses: 1, clk: ["G"] });
  Object.assign(f.patch.blocks[1], { kind: "bernoulli", voice: "", branchVoices: [closedFirst ? "oh" : "ch", "kick"], prob: 100, steps: 1, pulses: 1, clk: ["0"] });
  (f.engine as unknown as { tick: (time: number, pulse: number) => void }).tick(1, 0);
  if (closedFirst) {
    // 909 closed hat: one noise gain and the metallic envelope, no open sources.
    expect(f.gains).toHaveLength(2);
  } else {
    expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
    expect(f.gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  }
});

it.each(["muted", "zero level"])("does not choke on a %s closed hat", (mode) => {
  const f = fixture("oh", { chokeMode: 1 });
  f.trigger();
  if (mode === "muted") f.patch.voices.ch.mute = true;
  else f.patch.voices.ch.level = 0;
  f.trigger("ch", 1.1);
  expect(f.gains[0].gain.cancelScheduledValues).not.toHaveBeenCalled();
});

it("preserves layered hats with choke disabled and leaves new disabled hits outside the group", () => {
  const f = fixture("oh", { chokeMode: 0 });
  f.trigger();
  f.trigger("ch", 1.1);
  expect(f.gains.every((gain) => gain.gain.cancelScheduledValues.mock.calls.length === 0)).toBe(true);
  f.patch.voices.oh.custom.chokeMode = 1;
  f.trigger("oh", 1.2);
  const enabledGate = f.gains[4];
  f.patch.voices.oh.custom.chokeMode = 0;
  f.trigger("oh", 1.25);
  f.trigger("ch", 1.3);
  expect(enabledGate.gain.cancelScheduledValues).toHaveBeenCalledWith(1.3);
  expect(f.gains.filter((gain) => gain.gain.cancelScheduledValues.mock.calls.length > 0)).toEqual([enabledGate]);
});

it.each(["stop", "reset", "resetPattern", "destroy"] as const)("cancels future choked hats on engine %s", (action) => {
  const f = fixture("oh", { chokeMode: 1 });
  f.trigger();
  f.trigger("ch", 1.1);
  f.context.currentTime = 0.9;
  f.engine[action]();
  expect(f.gains[0].gain.cancelScheduledValues).toHaveBeenLastCalledWith(0.9);
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0.9);
});

it("couples bassline accents to filter brightness and decay while retaining independent amplitude", () => {
  const f = fixture("bassline", { accent: 100, accentFilter: 50, accentDecay: 100, filterDecay: 100, cutoff: 200, envelopeAmount: 50, ampDecay: 500 });
  f.trigger();
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(2400, 1);
  expect(f.filters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(200, 1.2);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.5);
});

it.each([-1, 0, 0.5, 1, 2])("scales routed bassline accents with positive Level modulation (%s)", (level) => {
  const f = fixture("bassline", { accentSource: 1, accent: 100, accentFilter: 100, accentDecay: 100, filterDecay: 100, cutoff: 200, envelopeAmount: 50 });
  f.trigger("bassline", 1, { level });
  const accent = Math.min(1, Math.max(0, level));
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(1200 * 2 ** (2 * accent), 1);
  expect(f.filters[0].frequency.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.1 + 0.1 * accent);
  expect(f.gains[0].gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.1 + 0.1 * accent);
});

it("combines shared-voice and block Level routes before determining the bassline accent", () => {
  const f = fixture("bassline", { accentSource: 1, accent: 100, accentFilter: 100, cutoff: 200, envelopeAmount: 50 });
  f.patch.voices.bassline.modulations = [{ source: "0", destination: "level", amount: -0.5 }];
  // Unstarted voice block 0 has LFO=0, so the negative route contributes +0.5.
  f.trigger("bassline", 1, { level: 0.5 });
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(4800, 1);
});

it("retains the original bassline envelope with added accent controls disabled", () => {
  const f = fixture("bassline", { accent: 100, accentSource: 0, accentFilter: 0, accentDecay: 0, filterDecay: 100, cutoff: 200, envelopeAmount: 50 });
  f.trigger("bassline", 1, { level: 0.5 });
  expect(f.filters[0].frequency.setValueAtTime).toHaveBeenLastCalledWith(1200, 1);
  expect(f.filters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(200, 1.1);
  expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(1.3, 1.004);
});

it.each(["bassline", "lead"] as const)("tracks %s cutoff above and below C3 without changing amplitude", (id) => {
  for (const tracking of [0, 50, 100]) {
    for (const tune of [-12, 12]) {
      const f = fixture(id, { filterTracking: tracking, octave: 3, root: 0, cutoff: 400, envelopeAmount: 0, filterDecay: 200 });
      f.patch.voices[id].tune = tune;
      f.trigger();
      const expected = 400 * 2 ** (tune / 12 * tracking / 100);
      expect(f.filters[0].frequency.setValueAtTime.mock.lastCall![0]).toBeCloseTo(expected);
      expect(f.filters[0].frequency.exponentialRampToValueAtTime.mock.lastCall![0]).toBeCloseTo(expected);
      expect(f.gains[0].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(id === "lead" ? 0.72 : 0.804);
    }
  }
});

it.each(["bassline", "lead"] as const)("uses the quantized V/Oct note for %s filter tracking", (id) => {
  const f = fixture(id, { filterTracking: 100, octave: 3, root: 0, scale: 1, cutoff: 400, envelopeAmount: 0 });
  f.patch.voices[id].modulations = [{ source: "0", destination: "vOct", amount: 1 }];
  vi.spyOn(f.engine as unknown as { sourceLfo: () => number }, "sourceLfo").mockReturnValue(0.26);
  f.trigger();
  // 3.12 incoming semitones snap to E3 in C major (four semitones).
  expect(f.filters[0].frequency.setValueAtTime.mock.lastCall![0]).toBeCloseTo(400 * 2 ** (4 / 12));
});

it.each(["bassline", "lead"] as const)("keeps %s tracking a glide after filter decay ends and across an interrupted slide", (id) => {
  const f = fixture(id, { filterTracking: 100, octave: 3, root: 0, playMode: 1, glide: 200, ampDecay: 1000, release: 1000, cutoff: 400, envelopeAmount: 0, filterDecay: 100, pulseMix: 0 });
  f.trigger();
  f.trigger(id, 1.1, { tune: 1 });
  expect(f.filters[1].frequency.setValueAtTime.mock.lastCall![0]).toBeCloseTo(400);
  const ramps = f.filters[1].frequency.exponentialRampToValueAtTime.mock.calls;
  expect(ramps[0][0]).toBeCloseTo(400 * Math.sqrt(2));
  expect(ramps[0][1]).toBeCloseTo(1.2);
  expect(ramps[1][0]).toBeCloseTo(800);
  expect(ramps[1][1]).toBeCloseTo(1.3);
  f.trigger(id, 1.2, { tune: -1 });
  expect(f.filters[2].frequency.setValueAtTime.mock.lastCall![0]).toBeCloseTo(400 * Math.sqrt(2));
  expect(f.filters[2].frequency.exponentialRampToValueAtTime.mock.lastCall![0]).toBeCloseTo(200);
});

it("combines bassline tracking with accent brightness and keeps accent timing", () => {
  const f = fixture("bassline", { filterTracking: 100, octave: 3, root: 0, accent: 100, accentFilter: 50, accentDecay: 100, filterDecay: 100, cutoff: 200, envelopeAmount: 50, ampDecay: 500 });
  f.trigger("bassline", 1, { tune: 1 });
  expect(f.filters[0].frequency.setValueAtTime.mock.lastCall![0]).toBeCloseTo(4800);
  const ramp = f.filters[0].frequency.exponentialRampToValueAtTime.mock.lastCall!;
  expect(ramp[0]).toBeCloseTo(400);
  expect(ramp[1]).toBeCloseTo(1.2);
  expect(f.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.5);
});

it.each(["bassline", "lead"] as const)("retriggers %s in mono and glides from the sounding pitch", (id) => {
  const f = fixture(id, { playMode: 1, glide: 100, ampDecay: 1000, release: 1000, pulseMix: 0 });
  f.trigger();
  const frequency = f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0];
  f.trigger(id, 1.1, { tune: 1 });
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(frequency, 1.1);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(frequency * 2);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.2);
  expect(f.gains[1].gain.linearRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.105);
  // Each hit still gets the original amplitude attack and a fresh filter envelope.
  expect(f.gains[2].gain.setValueAtTime).toHaveBeenCalledWith(0, 1.1);
  expect(f.gains[2].gain.linearRampToValueAtTime.mock.calls[0][1]).toBeGreaterThan(1.1);
  expect(f.filters[1].frequency.exponentialRampToValueAtTime.mock.calls[0][1]).toBeGreaterThan(1.1);
});

it.each(["bassline", "lead"] as const)("keeps %s polyphonic by default, even with a stored glide value", (id) => {
  const f = fixture(id, { glide: 100, pulseMix: 0 });
  f.trigger();
  f.trigger(id, 1.1, { tune: 1 });
  expect(f.oscillators[1].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0] * 2);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(f.gains[1].gain.cancelScheduledValues).not.toHaveBeenCalled();
});

it.each(["bassline", "lead"] as const)("shapes %s square pulses without disturbing glide or filter tracking", (id) => {
  const f = fixture(id, { waveform: 1, pulseWidth: 25, playMode: 1, glide: 200, filterTracking: 100, octave: 3, root: 0, cutoff: 400, envelopeAmount: 0, filterDecay: 100, ampDecay: 1000, release: 1000, pulseMix: 0 });
  f.trigger();
  f.trigger(id, 1.1, { tune: 1 });
  expect(f.context.createPeriodicWave).toHaveBeenCalledOnce();
  const wave = f.context.createPeriodicWave.mock.results[0].value;
  expect(wave.constraints).toEqual({ disableNormalization: false });
  for (const oscillator of f.oscillators) expect(oscillator.setPeriodicWave).toHaveBeenCalledWith(wave);
  const pitch = f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0];
  expect(f.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(pitch, 1.1);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime.mock.lastCall![0]).toBeCloseTo(pitch * 2);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.3);
  expect(f.filters[1].frequency.exponentialRampToValueAtTime.mock.lastCall![0]).toBeCloseTo(800);
});

it("shares the lead pulse shape between main and companion while leaving the sine sub intact", () => {
  const f = fixture("lead", { waveform: 1, pulseWidth: 30, subLevel: 40, pulseMix: 50, detune: 12 });
  f.trigger();
  expect(f.context.createPeriodicWave).toHaveBeenCalledOnce();
  const wave = f.context.createPeriodicWave.mock.results[0].value;
  expect(f.oscillators[0].setPeriodicWave).toHaveBeenCalledWith(wave);
  expect(f.oscillators[1].type).toBe("sine");
  expect(f.oscillators[1].setPeriodicWave).not.toHaveBeenCalled();
  expect(f.oscillators[2].setPeriodicWave).toHaveBeenCalledWith(wave);
  const pitch = f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0];
  expect(f.oscillators[2].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(pitch * 2 ** (12 / 1200));
});

it.each(["bassline", "lead"] as const)("keeps the native %s square and avoids allocating wave tables at 50 percent", (id) => {
  const f = fixture(id, { waveform: 1, pulseWidth: 50 });
  f.trigger();
  expect(f.context.createPeriodicWave).not.toHaveBeenCalled();
  expect(f.oscillators.every((oscillator) => oscillator.type === "square" && oscillator.setPeriodicWave.mock.calls.length === 0)).toBe(true);
});

it("leaves saw and triangle mains unchanged while shaping only an audible square companion", () => {
  const bass = fixture("bassline", { waveform: 0, pulseWidth: 10 });
  bass.trigger();
  expect(bass.context.createPeriodicWave).not.toHaveBeenCalled();
  for (const waveform of [0, 2]) {
    const f = fixture("lead", { waveform, pulseWidth: 10, pulseMix: 0 });
    f.trigger();
    expect(f.context.createPeriodicWave).not.toHaveBeenCalled();
    f.patch.voices.lead.custom.pulseMix = 30;
    f.trigger("lead", 1.1);
    expect(f.oscillators[1].setPeriodicWave).not.toHaveBeenCalled();
    expect(f.oscillators[2].setPeriodicWave).toHaveBeenCalledOnce();
  }
});

it("bounds pulse-wave caching, reuses recent shapes across synths, and clears tables on teardown", () => {
  const f = fixture("bassline", { waveform: 1, pulseWidth: 10 });
  for (let width = 10; width <= 17; width++) {
    f.patch.voices.bassline.custom.pulseWidth = width;
    f.trigger();
  }
  Object.assign(f.patch.voices.lead.custom, { waveform: 1, pulseWidth: 10, pulseMix: 0 });
  f.trigger("lead"); // Retain the oldest table by using it again.
  expect(f.context.createPeriodicWave).toHaveBeenCalledTimes(8);
  const oldWave = f.context.createPeriodicWave.mock.results[1].value;
  for (const width of [18, 10, 11]) {
    f.patch.voices.bassline.custom.pulseWidth = width;
    f.trigger();
  }
  expect(f.context.createPeriodicWave).toHaveBeenCalledTimes(10); // 11 was evicted, 10 was retained.
  expect(f.oscillators[1].setPeriodicWave).toHaveBeenCalledWith(oldWave); // Sounding notes keep their wave.
  expect(f.oscillators[1].setPeriodicWave).toHaveBeenCalledOnce();
  f.engine.destroy();
  Object.assign(f.engine, { context: f.context });
  f.trigger();
  expect(f.context.createPeriodicWave).toHaveBeenCalledTimes(11);
});

it("glides the lead main, sub and companion together while preserving their tuning", () => {
  const f = fixture("lead", { playMode: 1, glide: 200, subLevel: 30, pulseMix: 25, detune: 12, release: 1000 });
  f.trigger();
  f.trigger("lead", 1.1, { tune: 1 });
  const main = f.oscillators[3];
  const sub = f.oscillators[4];
  const companion = f.oscillators[5];
  const start = main.frequency.setValueAtTime.mock.calls[0][0];
  const target = main.frequency.exponentialRampToValueAtTime.mock.calls[0][0];
  expect(sub.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(start / 2);
  expect(sub.frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(target / 2);
  expect(companion.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(start * 2 ** (12 / 1200));
  expect(companion.frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(target * 2 ** (12 / 1200));
  for (const oscillator of [main, sub, companion]) expect(oscillator.frequency.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.3);
});

it("keeps high-register polyphonic sub tuning independent of the main oscillator's Nyquist limit", () => {
  const f = fixture("lead", { octave: 6, root: 11, scale: 0, subLevel: 50, pulseMix: 0 });
  f.patch.voices.lead.tune = 12;
  f.patch.voices.lead.modulations = [{ source: "0", destination: "vOct", amount: 1 }];
  // The source's pitch voltage is injected through the existing LFO boundary.
  vi.spyOn(f.engine as unknown as { sourceLfo: () => number }, "sourceLfo").mockReturnValue(1);
  f.trigger("lead", 1, { tune: 1 });
  expect(f.oscillators[0].frequency.setValueAtTime.mock.calls[0][0]).toBe(15680);
  expect(f.oscillators[1].frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(7902.13, 1);
});

it("keeps bassline and lead ownership independent and ignores muted or silent triggers", () => {
  const f = fixture("bassline", { playMode: 1, glide: 100, ampDecay: 1000 });
  f.patch.voices.lead.custom.playMode = 1;
  f.trigger();
  f.trigger("lead", 1.1);
  f.patch.voices.bassline.mute = true;
  f.trigger("bassline", 1.2);
  f.patch.voices.bassline.mute = false;
  f.patch.voices.bassline.level = 0;
  f.trigger("bassline", 1.3);
  expect(f.gains[1].gain.cancelScheduledValues).not.toHaveBeenCalled();
});

it("resolves simultaneous routed synth hits without doubled attacks or an unheard glide source", () => {
  const f = fixture("bassline", { playMode: 1, glide: 100 });
  Object.assign(f.patch.blocks[0], { kind: "voice", voice: "bassline", steps: 1, pulses: 1, clk: ["G"] });
  Object.assign(f.patch.blocks[1], { kind: "bernoulli", voice: "", branchVoices: ["bassline", "kick"], prob: 100, steps: 1, pulses: 1, clk: ["0"] });
  (f.engine as unknown as { tick: (time: number, pulse: number) => void }).tick(1, 0);
  expect(f.oscillators).toHaveLength(2);
  expect(f.gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(f.oscillators[1].frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();
});

it.each(["stop", "reset", "resetPattern", "destroy"] as const)("cancels synth notes scheduled ahead on %s", (action) => {
  const f = fixture("bassline", { playMode: 1, glide: 100 });
  f.trigger();
  f.trigger("lead", 1.1);
  f.context.currentTime = 0.9;
  f.engine[action]();
  for (const gate of [f.gains[1], f.gains[3]]) {
    expect(gate.gain.cancelScheduledValues).toHaveBeenLastCalledWith(0.9);
    expect(gate.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0.9);
  }
});
