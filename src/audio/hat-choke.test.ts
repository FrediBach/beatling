import { expect, it, vi } from "vitest";
import { HatChoke } from "./hat-choke";

function gainNode() {
  return {
    gain: { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(), disconnect: vi.fn(),
  };
}

function fixture() {
  const nodes: ReturnType<typeof gainNode>[] = [];
  const context = { currentTime: 0, createGain: vi.fn(() => {
    const node = gainNode();
    nodes.push(node);
    return node;
  }) };
  const group = new HatChoke();
  const open = (time = 1, duration = 1) => group.open(context as unknown as AudioContext, {} as AudioNode, time, duration);
  return { group, nodes, context, open };
}

it("schedules the choke at audio time and retains the gate until the fade is audible", () => {
  const f = fixture();
  f.open();
  f.group.close(1.2, 0.025);
  expect(f.nodes[0].gain.setValueAtTime).toHaveBeenLastCalledWith(1, 1.2);
  expect(f.nodes[0].gain.linearRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.225);
  f.group.prune(1.21);
  expect(f.nodes[0].disconnect).not.toHaveBeenCalled();
  f.group.prune(1.23);
  expect(f.nodes[0].disconnect).toHaveBeenCalledOnce();
});

it("does not restart a closing tail or close the next open hit", () => {
  const f = fixture();
  f.open();
  f.group.close(1.1, 0.1);
  f.group.close(1.12, 0.1);
  expect(f.nodes[0].gain.cancelScheduledValues).toHaveBeenCalledTimes(1);
  f.open(1.13);
  expect(f.nodes[1].gain.cancelScheduledValues).not.toHaveBeenCalled();
});

it("ramps from the current fade level when stopped mid-choke", () => {
  const f = fixture();
  f.open();
  f.group.close(1.1, 0.1);
  f.group.reset(1.15);
  expect(f.nodes[0].gain.cancelScheduledValues).toHaveBeenLastCalledWith(1.15);
  expect(f.nodes[0].gain.setValueAtTime.mock.lastCall![0]).toBeCloseTo(0.5);
  expect(f.nodes[0].gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.155);
});

it("cancels a future close on reset without lifting or replaying the hat", () => {
  const f = fixture();
  f.open();
  f.group.close(1.2, 0.01);
  f.group.reset(1.1);
  expect(f.nodes[0].gain.cancelScheduledValues).toHaveBeenLastCalledWith(1.1);
  expect(f.nodes[0].gain.setValueAtTime).toHaveBeenLastCalledWith(1, 1.1);
  expect(f.nodes[0].gain.linearRampToValueAtTime.mock.lastCall![1]).toBeCloseTo(1.105);
  // The previous run's closed-hit timestamp cannot suppress a restarted open hit.
  expect(f.open(1.2)).not.toBeNull();
});

it("reclaims naturally ended gates and bounds retained hats in routed bursts", () => {
  const f = fixture();
  for (let i = 0; i < 128; i++) expect(f.open()).not.toBeNull();
  expect(f.open()).toBeNull();
  expect(f.context.createGain).toHaveBeenCalledTimes(128);
  f.context.currentTime = 2.07;
  expect(f.open(2.1)).not.toBeNull();
  expect(f.nodes.slice(0, 128).every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
});
