import { afterEach, expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
