import { afterEach, expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shows audible clock pulses and effective divisions, respecting lookahead, swing and reset", async () => {
  vi.useFakeTimers();
  let now = 0;
  const node = () => ({ connect: vi.fn(), gain: { value: 0 }, threshold: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } });
  vi.stubGlobal("AudioContext", class {
    get currentTime() { return now; }
    state = "running";
    sampleRate = 1;
    destination = {};
    createGain = node;
    createDynamicsCompressor = node;
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
    await engine.start();
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
    engine.reset();
    expect(engine.snapshot().clockPulse).toBe(-1);
    expect(engine.snapshot().blocks.every((block) => block.position === -1)).toBe(true);
    engine.stop();
    expect(engine.snapshot().clockPulse).toBe(-1);
  } finally { engine.destroy(); }
});
