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
  patch.blocks[1].div = 2;
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
    now = 0.081;
    expect(engine.snapshot().clockPulse).toBe(0);
    expect(engine.snapshot().blocks[0].position).toBe(0);
    expect(engine.snapshot().blocks[1].position).toBe(-1);
    now = 0.22;
    vi.advanceTimersByTime(20);
    expect(engine.snapshot().clockPulse).toBe(0);
    now = 0.237;
    expect(engine.snapshot().clockPulse).toBe(1);
    expect(engine.snapshot().blocks[1]).toMatchObject({ position: 0, effective: { div: 2 } });
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
