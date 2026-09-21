import { clamp, euclidHit, lfoValue } from "./euclid";
import type { EffectiveBlock, LfoShape } from "./types";

type Rhythm = Pick<EffectiveBlock, "steps" | "pulses" | "rot">;

/** Locate the enclosing hit-to-hit interval, including across the pattern boundary. */
export function euclideanCycle(position: number, rhythm: Rhythm): { start: number; length: number; phase: number } | null {
  if (rhythm.pulses <= 0) return null;
  const step = Math.floor(position);
  for (let back = 0; back < rhythm.steps; back++) {
    const start = step - back;
    if (!euclidHit(start, rhythm.steps, rhythm.pulses, rhythm.rot)) continue;
    for (let length = 1; length <= rhythm.steps; length++) {
      if (euclidHit(start + length, rhythm.steps, rhythm.pulses, rhythm.rot)) {
        return { start, length, phase: (position - start) / length };
      }
    }
  }
  return null;
}

export function euclideanLfoValue(shape: LfoShape, position: number, rhythm: Rhythm, random: number): number {
  const cycle = euclideanCycle(position, rhythm);
  // Internal LFO values are 0..1; 0.5 means zero bipolar modulation.
  return cycle ? lfoValue(shape, cycle.phase, random) : 0.5;
}

/** Immutable clock anchor shared by scheduler sampling and audible-time snapshots. */
export interface LfoFrame {
  time: number;
  position: number;
  stepDuration: number;
  rhythm: Rhythm;
  shape: LfoShape;
  random: number;
  euclidean: boolean;
}

export function sampleLfo(frame: LfoFrame, time: number): { value: number; position: number } {
  // Predict only the current step from the latest incoming clock interval. If
  // that clock stops, hold at the next boundary rather than free-running.
  const fraction = frame.euclidean ? clamp((time - frame.time) / frame.stepDuration, 0, 1) : 0;
  const position = frame.position + fraction;
  return {
    position: position % frame.rhythm.steps,
    value: frame.euclidean
      ? euclideanLfoValue(frame.shape, position, frame.rhythm, frame.random)
      : lfoValue(frame.shape, frame.position / frame.rhythm.steps, frame.random),
  };
}
