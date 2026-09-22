import { expect, it, vi } from "vitest";
import { SynthArticulation } from "./synth-articulation";

function gainNode() {
  return {
    gain: { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(), disconnect: vi.fn(),
  };
}

function fixture() {
  const nodes: ReturnType<typeof gainNode>[] = [];
  const context = { currentTime: 0, sampleRate: 48000, createGain: vi.fn(() => {
    const node = gainNode();
    nodes.push(node);
    return node;
  }) };
  const bank = new SynthArticulation();
  const destination = {} as AudioNode;
  const play = (time = 1, frequency = 100, mono = true, glide = 0.2, duration = 1) => bank.begin(context as unknown as AudioContext, destination, time, duration, frequency, mono, glide);
  return { bank, nodes, context, destination, play };
}

it("keeps polyphonic notes independent and ignores glide", () => {
  const f = fixture();
  f.play(1, 100, false);
  const note = f.play(1.1, 200, false)!;
  expect(note).toMatchObject({ from: 200, target: 200, glideEnd: 1.1 });
  expect(f.nodes.every((node) => node.gain.cancelScheduledValues.mock.calls.length === 0)).toBe(true);
  expect(f.nodes[0].connect).toHaveBeenCalledWith(f.destination);
});

it("fades all old polyphonic tails when switching to mono, without restarting existing fades", () => {
  const f = fixture();
  f.play(1, 100, false);
  f.play(1.05, 150, false);
  f.play(1.1, 200);
  for (const node of f.nodes.slice(0, 2)) {
    expect(node.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 1.1);
    expect(node.gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.105);
  }
  f.play(1.102, 300);
  expect(f.nodes[0].gain.cancelScheduledValues).toHaveBeenCalledTimes(1);
});

it("continues an interrupted glide from its actual pitch", () => {
  const f = fixture();
  expect(f.play()).toMatchObject({ from: 100, glideEnd: 1 });
  expect(f.play(1.1, 400, true, 0.4)).toMatchObject({ from: 100, target: 400, glideEnd: 1.5 });
  // Half of an exponential two-octave slide is one octave, not half the Hz gap.
  expect(f.play(1.3, 300)!.from).toBeCloseTo(200);
});

it("snaps to the new pitch after a gap or with glide disabled", () => {
  const f = fixture();
  f.play();
  expect(f.play(2.1, 200)).toMatchObject({ from: 200, glideEnd: 2.1 });
  expect(f.play(2.2, 300, true, 0)).toMatchObject({ from: 300, glideEnd: 2.2 });
});

it("gives the last simultaneous hit priority without gliding from an unheard first note", () => {
  const f = fixture();
  f.play(1, 100);
  const note = f.play(1, 300)!;
  expect(f.nodes[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
  expect(f.nodes[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  expect(note).toMatchObject({ from: 300, target: 300, glideEnd: 1 });
  f.play(1.1, 400);
  expect(f.play(1.1, 500)).toMatchObject({ from: 300, target: 500 });
});

it("retains scheduled gates until their fade reaches the actual audio clock", () => {
  const f = fixture();
  f.play();
  f.play(1.1, 200);
  f.bank.prune(1.102);
  expect(f.nodes[0].disconnect).not.toHaveBeenCalled();
  f.bank.prune(1.11);
  expect(f.nodes[0].disconnect).toHaveBeenCalledOnce();
});

it("cancels future notes and clears pitch memory on reset", () => {
  const f = fixture();
  f.play();
  f.play(1.1, 200);
  f.bank.reset(0.9);
  for (const node of f.nodes) {
    expect(node.gain.cancelScheduledValues).toHaveBeenLastCalledWith(0.9);
    expect(node.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0.9);
  }
  expect(f.play(1, 300)).toMatchObject({ from: 300, glideEnd: 1 });
});

it("stops a mid-fade note from its current gain and silences future hits", () => {
  const f = fixture();
  f.play();
  f.play(1.1, 200);
  f.play(1.2, 300);
  f.bank.reset(1.1025);
  expect(f.nodes[0].gain.setValueAtTime.mock.lastCall![0]).toBeCloseTo(0.5);
  expect(f.nodes[1].gain.setValueAtTime).toHaveBeenLastCalledWith(1, 1.1025);
  expect(f.nodes[2].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1.1025);
});

it("bounds tracking and reclaims completed notes without timers", () => {
  const f = fixture();
  for (let i = 0; i < 256; i++) expect(f.play(1, 100, false)).not.toBeNull();
  expect(f.play()).toBeNull();
  expect(f.context.createGain).toHaveBeenCalledTimes(256);
  f.context.currentTime = 2.1;
  expect(f.play(2.2, 200)).toMatchObject({ from: 200, glideEnd: 2.2 });
  expect(f.nodes.slice(0, 256).every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
});
