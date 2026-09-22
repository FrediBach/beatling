import { expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";
import { VOICE_DEFS } from "@/lib/constants";
import { VOICE_PARAMETER_SECTIONS } from "@/lib/voice-config";
import type { EffectiveBlock, VoiceId } from "@/lib/types";

// Record only the native Web Audio boundary; exercise the real voice dispatch,
// synthesis graph and scheduled envelopes without mocking synthesis helpers.
function parameter() {
  return { value: 0, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}
function node() {
  return {
    type: "", loop: false, buffer: null, gain: parameter(), frequency: parameter(), Q: parameter(), playbackRate: parameter(),
    connect: vi.fn((target: unknown) => target), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
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
  const context = { currentTime: 0, sampleRate: 32000, close: vi.fn(), createGain: create(gains), createBiquadFilter: create(filters), createOscillator: create(oscillators), createBufferSource: create(sources) };
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

it("keeps independent rim noise silent at zero Noise level without muting its tone", () => {
  const f = fixture("rim", { noiseMode: 1, noiseLevel: 0, toneLevel: 70 });
  f.trigger();
  const noiseGain = f.sources[0].connect.mock.calls[0][0] as ReturnType<typeof node>;
  expect(noiseGain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(noiseGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(f.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0.7, 1);
});

it.each(["custom", "808", "909"] as const)("preserves the original linked rim graph for %s", (machine) => {
  const f = fixture("rim", { noiseMode: machine === "custom" ? 0 : 1, noiseDecay: 180 });
  f.patch.voices.rim.machine = machine;
  f.trigger();
  expect(f.filters).toHaveLength(1);
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
  const f = fixture("oh", { chokeMode: 1, chokeRelease: 20, duration, metalDecay });
  f.trigger();
  const gate = f.gains[0];
  f.context.currentTime = 1.3;
  f.trigger("oh", 1.3); // Reclaims expired gates using the actual audio clock.
  expect(gate.disconnect).not.toHaveBeenCalled();
  f.trigger("ch", 1.4);
  expect(gate.gain.cancelScheduledValues).toHaveBeenCalledWith(1.4);
  expect(gate.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.42);
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
