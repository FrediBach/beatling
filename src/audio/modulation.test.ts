import { afterEach, expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";

function clockFixture() {
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
  patch.bpm = 120;
  patch.swing = 0;
  patch.blocks.forEach((block) => { block.voice = ""; });
  Object.assign(patch.blocks[0], { steps: 8, pulses: 3, shape: "ramp" });
  patch.blocks[1].modulations = [{ source: "0", destination: "tune", amount: 1 }];
  const engine = new SequencerEngine(patch);
  return { patch, engine, time(value: number, schedule = true) { now = value; if (schedule) vi.advanceTimersByTime(20); return engine.snapshot(); } };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("interpolates Euclidean LFOs at audible time without leaking queued future clocks", async () => {
  const { engine, time } = clockFixture();
  try {
    await engine.start();
    expect(time(0, false).blocks[0].lfo).toBe(0.5);
    const between = time(0.1425); // Halfway through step 0; step 1 is already scheduled.
    expect(between.blocks[0].position).toBe(0);
    expect(between.blocks[0].lfoPosition).toBeCloseTo(0.5);
    expect(between.blocks[0].lfo).toBeCloseTo(1 / 6);
    const next = time(0.2050001);
    expect(next.blocks[0].position).toBe(1);
    expect(next.blocks[0].lfo).toBeCloseTo(1 / 3);
    expect(next.blocks[1].effective.tune).toBeCloseTo(-1 / 3);
    expect(time(0.3300001).blocks[0].lfo).toBeCloseTo(2 / 3);
    expect(time(0.4550001).blocks[0].lfo).toBeCloseTo(0);
    engine.reset();
    expect(engine.snapshot().blocks[0]).toMatchObject({ position: -1, lfo: 0.5 });
    expect(time(0.486).blocks[0].lfo).toBeCloseTo(0);
  } finally { engine.destroy(); }
});

it("uses divided and routed clocks and leaves empty modulators neutral", async () => {
  const { patch, engine, time } = clockFixture();
  patch.blocks[0].div = 2;
  patch.blocks[2].clk = ["0"];
  Object.assign(patch.blocks[2], { steps: 8, pulses: 3, div: 1 });
  patch.blocks[3].modulations = [{ source: "4", destination: "tune", amount: 1 }];
  try {
    await engine.start();
    expect(time(0.081).blocks[0].position).toBe(-1);
    time(0.15);
    const first = time(0.2050001);
    expect(first.blocks[0].position).toBe(0);
    expect(first.blocks[2].position).toBe(0);
    expect(time(0.3300001).blocks[0].lfo).toBeCloseTo(1 / 6);
    expect(engine.snapshot().blocks[3].effective.tune).toBe(0);
    engine.stop();
    expect(engine.snapshot().blocks.every((block) => block.lfo === 0.5 && block.position === -1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  } finally { engine.destroy(); }
});

it("chooses a fresh random value at Euclidean hits, holding through intervening rests", async () => {
  const { patch, engine, time } = clockFixture();
  patch.blocks[0].shape = "rnd";
  const random = vi.spyOn(Math, "random").mockReturnValue(0.2);
  try {
    await engine.start();
    expect(time(0.081, false).blocks[0].lfo).toBe(0.2);
    random.mockReturnValue(0.7);
    expect(time(0.2050001).blocks[0].lfo).toBe(0.2);
    expect(time(0.3300001).blocks[0].lfo).toBe(0.2);
    expect(time(0.4550001).blocks[0].lfo).toBe(0.7);
  } finally { engine.destroy(); }
});

it("resets the waveform anchor from another block at audible time", async () => {
  const { patch, engine, time } = clockFixture();
  patch.blocks[0].rst = "2";
  Object.assign(patch.blocks[2], { steps: 2, pulses: 1 });
  try {
    await engine.start();
    expect(time(0.081, false).blocks[0]).toMatchObject({ position: -1, lfo: 0.5 });
    expect(time(0.2050001).blocks[0].position).toBe(0);
    // The reset at 0.33 has been queued, but must not appear yet.
    expect(time(0.2675).blocks[0].lfo).toBeCloseTo(1 / 6);
    expect(time(0.3300001).blocks[0]).toMatchObject({ position: -1, lfo: 0.5 });
    expect(time(0.4550001).blocks[0].position).toBe(0);
  } finally { engine.destroy(); }
});
