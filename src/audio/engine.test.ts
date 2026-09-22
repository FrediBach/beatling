import { afterEach, expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";
import { createPresetArrangement } from "@/lib/presets";
import { waveguideDamping, waveguideFeedback, waveguideFrequency } from "@/lib/effects";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([0, 1, 2, 3])("preserves Acid with Tom Fill's routed drum gaps and loop restart in variation %i", (variation) => {
  const patch = createPresetArrangement("acid-tom-fill").variations[variation].patch;
  const engine = new SequencerEngine(patch);
  // Exercise the real clock/routing/series scheduler, replacing only synthesis.
  const scheduler = engine as unknown as {
    tick: (time: number, pulse: number) => void;
    playVoice: (id: string, time: number, effective: unknown) => void;
  };
  const playVoice = vi.spyOn(scheduler, "playVoice").mockImplementation(() => undefined);
  const interval = 60 / patch.bpm / patch.rate;
  try {
    for (let step = 0; step <= 64; step++) scheduler.tick(0.08 + step * interval, step);
    const hits = (voice: string) => playVoice.mock.calls.filter(([id]) => id === voice).map(([, time]) => Math.round((time - 0.08) / interval));
    const twiceAndDownbeat = (cycle: number[]) => [...cycle, ...cycle.map((step) => step + 32), ...(cycle.includes(0) ? [64] : [])];
    expect(hits("kick")).toEqual(twiceAndDownbeat(variation === 2 ? [0, 8, 16, 24] : [0, 4, 8, 12, 16, 20, 24]));
    expect(hits("clap")).toEqual(twiceAndDownbeat([4, 12, 20]));
    expect(hits("ch")).toEqual(twiceAndDownbeat(Array.from({ length: variation === 2 ? 12 : 24 }, (_, step) => step * (variation === 2 ? 2 : 1))));
    expect(hits("ht")).toEqual(twiceAndDownbeat(variation === 2 ? [24] : [24, 26]));
    expect(hits("mt")).toEqual(twiceAndDownbeat(variation === 3 ? [28, 29] : [28]));
    expect(hits("lt")).toEqual(twiceAndDownbeat([30, 31]));
    for (const voice of ["bassline", "lead"]) {
      expect(hits(voice).length).toBeGreaterThan(0);
      expect(hits(voice).some((step) => step % 32 >= 24)).toBe(false);
    }
  } finally { engine.destroy(); }
});

it("maps Karplus–Strong controls onto a stable String/Tube feedback waveguide", async () => {
  vi.useFakeTimers();
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const gainNodes: ReturnType<typeof node>[] = [];
  const delayNodes: ReturnType<typeof node>[] = [];
  const filterNodes: ReturnType<typeof node>[] = [];
  function node() {
    const value = { connect: vi.fn(), gain: parameter(), frequency: parameter(), Q: parameter(), delayTime: parameter(), threshold: parameter(), ratio: parameter(), attack: parameter(), release: parameter() };
    value.connect.mockImplementation((destination?: unknown) => destination ?? value);
    return value;
  }
  vi.stubGlobal("AudioContext", class {
    currentTime = 2;
    state = "running";
    sampleRate = 48000;
    destination = {};
    createGain() { const value = node(); gainNodes.push(value); return value; }
    createDelay() { const value = node(); delayNodes.push(value); return value; }
    createBiquadFilter() { const value = node(); filterNodes.push(value); return value; }
    createDynamicsCompressor = node;
    createWaveShaper = node;
    createConvolver = node;
    createBuffer() { return { getChannelData: () => new Float32Array(2) }; }
    close() { return Promise.resolve(); }
  });
  const patch = createEmptyPatch();
  const engine = new SequencerEngine(patch);
  try {
    await engine.start();
    const effects = {
      ...patch.effects,
      karplus: { ...patch.effects.karplus, enabled: true, model: "tube" as const, tune: 24, body: 50, decay: 80 },
      sends: { ...patch.effects.sends, rim: { ...patch.effects.sends.rim, karplus: 50 } },
    };
    engine.setPatch({ ...patch, effects });
    expect(delayNodes).toHaveLength(3);
    expect(delayNodes[2].delayTime.setTargetAtTime).toHaveBeenLastCalledWith(1 / (waveguideFrequency(24) * 2), 2, 0.015);
    expect(filterNodes[6].frequency.setTargetAtTime).toHaveBeenLastCalledWith(waveguideDamping(50), 2, 0.015);
    expect(gainNodes.some((gain) => gain.gain.setTargetAtTime.mock.calls.some(([next]) => next === -waveguideFeedback(80)))).toBe(true);
    expect(gainNodes.some((gain) => gain.gain.setTargetAtTime.mock.calls.some(([next]) => next === 0.25))).toBe(true);
  } finally { engine.destroy(); }
});

it("observes post-master audio lazily without changing the audible path and releases analysis on stop/destroy", async () => {
  vi.useFakeTimers();
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn((destination: unknown) => destination), disconnect: vi.fn(), gain: parameter(), frequency: parameter(), Q: parameter(), delayTime: parameter(), threshold: parameter(), ratio: parameter(), attack: parameter(), release: parameter() });
  const master = node();
  const destination = {};
  const analyser = { disconnect: vi.fn(), frequencyBinCount: 512, getByteFrequencyData: vi.fn((data: Uint8Array) => data.fill(123)) };
  const createAnalyser = vi.fn(() => analyser);
  const close = vi.fn().mockResolvedValue(undefined);
  const createGain = vi.fn(node).mockReturnValueOnce(master);
  const construct = vi.fn();
  vi.stubGlobal("AudioContext", class {
    constructor() { construct(); }
    currentTime = 0;
    state = "running";
    sampleRate = 48000;
    destination = destination;
    createGain = createGain;
    createAnalyser = createAnalyser;
    createDynamicsCompressor = node;
    createWaveShaper = node;
    createBiquadFilter = node;
    createConvolver = node;
    createDelay = node;
    createBuffer() { return { getChannelData: () => new Float32Array(2) }; }
    close = close;
  });
  const engine = new SequencerEngine(createEmptyPatch());
  expect(engine.observeOutput()).toBeNull();
  expect(construct).not.toHaveBeenCalled();
  try {
    await engine.start();
    expect(createAnalyser).not.toHaveBeenCalled();
    const analysis = engine.observeOutput()!;
    expect(master.connect.mock.calls).toEqual([[destination], [analyser]]);
    expect(analysis.sampleRate).toBe(48000);
    const data = new Uint8Array(analysis.binCount);
    analysis.read(data);
    expect(data[0]).toBe(123);
    engine.stop();
    analysis.disconnect();
    expect(master.disconnect).toHaveBeenCalledExactlyOnceWith(analyser);
    expect(analyser.disconnect).toHaveBeenCalledOnce();
    expect(engine.observeOutput()).toBeNull();
    await engine.start();
    engine.observeOutput();
  } finally { engine.destroy(); }
  expect(analyser.disconnect).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledOnce();
});

it("shows audible clock pulses and effective divisions, respecting lookahead, swing and reset", async () => {
  vi.useFakeTimers();
  let now = 0;
  const gainNodes: ReturnType<typeof node>[] = [];
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  function node() {
    const value = {
      connect: vi.fn(),
      gain: parameter(),
      frequency: parameter(),
      Q: parameter(),
      delayTime: parameter(),
      threshold: parameter(),
      ratio: parameter(),
      attack: parameter(),
      release: parameter(),
    };
    value.connect.mockReturnValue(value);
    return value;
  }
  vi.stubGlobal("AudioContext", class {
    get currentTime() { return now; }
    state = "running";
    sampleRate = 1;
    destination = {};
    createGain() { const value = node(); gainNodes.push(value); return value; }
    createDynamicsCompressor = node;
    createWaveShaper = node;
    createBiquadFilter = node;
    createConvolver = node;
    createDelay = node;
    createBuffer() { return { getChannelData: () => new Float32Array(2) }; }
    close() { return Promise.resolve(); }
  });
  const patch = createEmptyPatch();
  patch.bpm = 120;
  patch.rate = 4;
  patch.swing = 50;
  patch.blocks[0].shape = "sqr";
  patch.blocks[1].shape = "sqr";
  patch.blocks[1].div = 2;
  patch.blocks[2].prob = 50;
  patch.blocks[2].modulations = [{ source: "0", destination: "prob", amount: 0.25 }, { source: "1", destination: "rot", amount: -0.5 }];
  const engine = new SequencerEngine(() => patch);
  try {
    const onBar = vi.fn();
    engine.setBarCallback(onBar);
    await engine.start();
    engine.setPatch({
      ...patch,
      effects: {
        ...patch.effects,
        distortion: { ...patch.effects.distortion, enabled: true },
        sends: { ...patch.effects.sends, kick: { ...patch.effects.sends.kick, distortion: 50 } },
      },
    });
    expect(gainNodes.some((gain) => gain.gain.setTargetAtTime.mock.calls.some(([value]) => value === 0.25))).toBe(true);
    expect(engine.snapshot().clockPulse).toBe(-1);
    expect(engine.snapshot().blocks[2].effective.prob).toBe(50);
    now = 0.081;
    expect(engine.snapshot().clockPulse).toBe(0);
    expect(engine.snapshot().blocks[0].position).toBe(0);
    expect(engine.snapshot().blocks[2].effective).toMatchObject({ prob: 75, rot: 8 });
    expect(engine.snapshot().blocks[1].position).toBe(-1);
    now = 0.22;
    vi.advanceTimersByTime(20);
    expect(engine.snapshot().clockPulse).toBe(0);
    now = 0.237;
    expect(engine.snapshot().clockPulse).toBe(1);
    expect(engine.snapshot().blocks[1]).toMatchObject({ position: 0, effective: { div: 2 } });
    expect(engine.snapshot().blocks[2].effective).toMatchObject({ prob: 75, rot: -8 });
    now = 1.96;
    vi.advanceTimersByTime(20);
    expect(onBar).toHaveBeenCalledTimes(1);
    engine.reset();
    expect(engine.snapshot().clockPulse).toBe(-1);
    expect(engine.snapshot().blocks.every((block) => block.position === -1)).toBe(true);
    engine.stop();
    expect(engine.snapshot().clockPulse).toBe(-1);
  } finally { engine.destroy(); }
});

it("routes every Euclidean hit to one Bernoulli voice without dropping it", async () => {
  vi.useFakeTimers();
  let now = 0;
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn((destination: unknown) => destination), gain: parameter(), frequency: parameter(), Q: parameter(), delayTime: parameter(), threshold: parameter(), ratio: parameter(), attack: parameter(), release: parameter() });
  vi.stubGlobal("AudioContext", class {
    get currentTime() { return now; }
    state = "running";
    sampleRate = 1;
    destination = {};
    createGain = node;
    createDynamicsCompressor = node;
    createWaveShaper = node;
    createBiquadFilter = node;
    createConvolver = node;
    createDelay = node;
    createBuffer() { return { getChannelData: () => new Float32Array(2) }; }
    close() { return Promise.resolve(); }
  });
  const patch = createEmptyPatch();
  patch.blocks.forEach((block) => { block.clk = []; });
  Object.assign(patch.blocks[0], { kind: "bernoulli", voice: "", branchVoices: ["kick", "snare"], steps: 4, pulses: 2, rot: 0, prob: 50, clk: ["G"] });
  patch.blocks[1].clk = ["0"];
  const engine = new SequencerEngine(patch);
  const playVoice = vi.spyOn(engine as unknown as { playVoice: (id: string, time: number, effective: unknown) => void }, "playVoice").mockImplementation(() => undefined);
  const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
  try {
    await engine.start();
    expect(playVoice.mock.calls.map(([voice]) => voice)).toEqual(["kick"]);
    random.mockReturnValue(0.9);
    now = 0.1;
    vi.advanceTimersByTime(20);
    expect(playVoice.mock.calls.map(([voice]) => voice)).toEqual(["kick"]);
    now = 0.23;
    vi.advanceTimersByTime(20);
    expect(playVoice.mock.calls.map(([voice]) => voice)).toEqual(["kick", "snare"]);
    now = 0.36;
    vi.advanceTimersByTime(20);
    expect(playVoice.mock.calls.map(([voice]) => voice)).toEqual(["kick", "snare"]);
  } finally { engine.destroy(); }
});

it("dispatches quantized pitches to the 303 and 101 inspired synth voices", async () => {
  vi.useFakeTimers();
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn((destination: unknown) => destination), gain: parameter(), frequency: parameter(), Q: parameter(), delayTime: parameter(), threshold: parameter(), ratio: parameter(), attack: parameter(), release: parameter() });
  vi.stubGlobal("AudioContext", class {
    currentTime = 0;
    state = "running";
    sampleRate = 1;
    destination = {};
    createGain = node;
    createDynamicsCompressor = node;
    createWaveShaper = node;
    createBiquadFilter = node;
    createConvolver = node;
    createDelay = node;
    createBuffer() { return { getChannelData: () => new Float32Array(2) }; }
    close() { return Promise.resolve(); }
  });
  const patch = createEmptyPatch();
  patch.blocks.forEach((block) => { block.clk = []; });
  Object.assign(patch.blocks[0], { kind: "voice", voice: "bassline", steps: 1, pulses: 1, clk: ["G"] });
  Object.assign(patch.blocks[1], { kind: "voice", voice: "lead", steps: 1, pulses: 1, clk: ["G"] });
  patch.voices.bassline.modulations = [{ source: "12", destination: "vOct", amount: 1 }];
  const engine = new SequencerEngine(patch);
  const bassline = vi.spyOn(engine as unknown as { bassline: (time: number, parameters: { frequency: number }) => void }, "bassline").mockImplementation(() => undefined);
  const lead = vi.spyOn(engine as unknown as { lead: (time: number, parameters: { frequency: number }) => void }, "lead").mockImplementation(() => undefined);
  try {
    await engine.start();
    expect(bassline).toHaveBeenCalledOnce();
    expect(bassline.mock.calls[0][1].frequency).toBeCloseTo(87.31, 1);
    expect(lead).toHaveBeenCalledOnce();
    expect(lead.mock.calls[0][1].frequency).toBeCloseTo(261.63, 1);
  } finally { engine.destroy(); }
});

it("plays a block's Euclidean rhythms in series for their configured cycle counts", () => {
  const patch = createEmptyPatch();
  Object.assign(patch.blocks[0], {
    steps: 2,
    pulses: 1,
    repeats: 2,
    series: [{ id: "second", steps: 3, pulses: 2, rot: 1, repeats: 1 }],
  });
  const engine = new SequencerEngine(patch);
  const advance = (engine as unknown as { advance: (index: number, time: number) => boolean }).advance.bind(engine);

  const frame = () => {
    advance(0, 0);
    return engine.snapshot().blocks[0];
  };
  expect(frame()).toMatchObject({ rhythmIndex: 0, position: 0, effective: { steps: 2, pulses: 1 } });
  expect(frame()).toMatchObject({ rhythmIndex: 0, position: 1 });
  expect(frame()).toMatchObject({ rhythmIndex: 0, position: 0 });
  expect(frame()).toMatchObject({ rhythmIndex: 0, position: 1 });
  expect(frame()).toMatchObject({ rhythmIndex: 1, position: 0, effective: { steps: 3, pulses: 2, rot: 1 } });
  expect(frame()).toMatchObject({ rhythmIndex: 1, position: 1 });
  expect(frame()).toMatchObject({ rhythmIndex: 1, position: 2 });
  expect(frame()).toMatchObject({ rhythmIndex: 0, position: 0 });

  engine.reset();
  expect(engine.snapshot().blocks[0]).toMatchObject({ rhythmIndex: 0, position: -1 });
  engine.destroy();
});

it("updates expanded effects and tempo sync without rebuilding the shared graph or impulses", async () => {
  vi.useFakeTimers();
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn((destination: unknown) => destination), gain: parameter(), frequency: parameter(), Q: parameter(), delayTime: parameter(), threshold: parameter(), ratio: parameter(), knee: parameter(), attack: parameter(), release: parameter(), curve: null as Float32Array | null, buffer: null as object | null });
  const filters: ReturnType<typeof node>[] = [];
  const delays: ReturnType<typeof node>[] = [];
  const compressors: ReturnType<typeof node>[] = [];
  const shaper = node();
  const convolver = node();
  const createGain = vi.fn(node);
  const createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("AudioContext", class {
    currentTime = 2;
    state = "running";
    sampleRate = 100;
    destination = {};
    createGain = createGain;
    createDynamicsCompressor() { const value = node(); compressors.push(value); return value; }
    createBiquadFilter() { const value = node(); filters.push(value); return value; }
    createDelay() { const value = node(); delays.push(value); return value; }
    createWaveShaper() { return shaper; }
    createConvolver() { return convolver; }
    createBuffer = createBuffer;
    close = close;
  });
  const patch = createEmptyPatch();
  const engine = new SequencerEngine(patch);
  expect(createGain).not.toHaveBeenCalled();
  try {
    await engine.start();
    const gainCount = createGain.mock.calls.length;
    const bufferCount = createBuffer.mock.calls.length;
    const studioImpulse = convolver.buffer;
    const oldCurve = shaper.curve;
    const effects = {
      ...patch.effects,
      distortion: { ...patch.effects.distortion, mode: "fold" as const, trim: -6 },
      reverb: { ...patch.effects.reverb, space: "hall" as const, preDelay: 80, lowCut: 400 },
      delay: { ...patch.effects.delay, sync: true, division: "1/8D" as const, lowCut: 600 },
      karplus: { ...patch.effects.karplus, octave: 1, excitation: 2400 },
      compressor: { ...patch.effects.compressor, knee: 6, makeup: 12 },
    };
    engine.setPatch({ ...patch, bpm: 120, effects });
    expect(shaper.curve).not.toBe(oldCurve);
    expect(delays[0].delayTime.setTargetAtTime).toHaveBeenLastCalledWith(0.08, 2, 0.015);
    expect(delays[1].delayTime.setTargetAtTime).toHaveBeenLastCalledWith(0.375, 2, 0.015);
    expect(delays[2].delayTime.setTargetAtTime).toHaveBeenLastCalledWith(1 / 128, 2, 0.015);
    expect(filters[1].frequency.setTargetAtTime).toHaveBeenLastCalledWith(400, 2, 0.015);
    expect(filters[3].frequency.setTargetAtTime).toHaveBeenLastCalledWith(600, 2, 0.015);
    expect(filters[5].frequency.setTargetAtTime).toHaveBeenLastCalledWith(2400, 2, 0.015);
    // The native API interprets low/highpass Q in dB. Both feedback filters must be non-boosting.
    expect(10 ** (filters[4].Q.value / 20)).toBeCloseTo(Math.SQRT1_2);
    expect(10 ** (filters[6].Q.value / 20)).toBeCloseTo(Math.SQRT1_2);
    expect(compressors[1].knee.setTargetAtTime).toHaveBeenLastCalledWith(6, 2, 0.015);
    const makeup = compressors[1].connect.mock.calls[0][0] as ReturnType<typeof node>;
    expect(makeup.gain.setTargetAtTime).toHaveBeenLastCalledWith(10 ** (12 / 20), 2, 0.015);
    const newCurve = shaper.curve;
    const kneeUpdates = compressors[1].knee.setTargetAtTime.mock.calls.length;
    engine.setPatch({ ...patch, bpm: 60, effects });
    expect(delays[1].delayTime.setTargetAtTime).toHaveBeenLastCalledWith(0.75, 2, 0.015);
    engine.setPatch({ ...patch, effects: { ...effects, reverb: { ...effects.reverb, space: "studio" } } });
    expect(convolver.buffer).toBe(studioImpulse);
    expect(shaper.curve).toBe(newCurve);
    expect(compressors[1].knee.setTargetAtTime).toHaveBeenCalledTimes(kneeUpdates);
    expect(createGain).toHaveBeenCalledTimes(gainCount);
    expect(createBuffer).toHaveBeenCalledTimes(bufferCount);
    expect(filters).toHaveLength(7);
    expect(delays).toHaveLength(3);
  } finally { engine.destroy(); }
  expect(close).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
