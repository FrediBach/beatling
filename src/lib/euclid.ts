import type { EffectiveBlock, LfoShape, SequencerBlock } from "@/lib/types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function euclidHit(index: number, steps: number, pulses: number, rotation: number): boolean {
  if (pulses <= 0) return false;
  if (pulses >= steps) return true;
  const offset = ((index + rotation) % steps + steps) % steps;
  return (offset * pulses) % steps < pulses;
}

export function lfoValue(shape: LfoShape, phase: number, randomValue: number): number {
  if (shape === "tri") {
    const value = phase * 2;
    return value > 1 ? 2 - value : value;
  }
  if (shape === "sqr") return phase < 0.5 ? 1 : 0;
  if (shape === "rnd") return randomValue;
  return phase;
}

export function effectiveBlock(block: SequencerBlock, sourceLfo = 0): EffectiveBlock {
  const effective: EffectiveBlock = {
    steps: block.steps,
    pulses: block.pulses,
    rot: block.rot,
    div: block.div,
    prob: block.prob,
    tune: 0,
    decay: 0,
    level: 0,
    mod: block.modSrc !== "" && block.modAmt !== 0 ? (sourceLfo * 2 - 1) * block.modAmt : 0,
  };

  switch (block.modDst) {
    case "pulses": effective.pulses = Math.round(block.pulses + effective.mod * 8); break;
    case "rot": effective.rot = Math.round(block.rot + effective.mod * effective.steps); break;
    case "prob": effective.prob = block.prob + effective.mod * 100; break;
    case "div": effective.div = Math.round(block.div + effective.mod * 4); break;
    case "tune": effective.tune = effective.mod; break;
    case "decay": effective.decay = effective.mod; break;
    case "level": effective.level = effective.mod; break;
  }

  effective.pulses = clamp(effective.pulses, 0, effective.steps);
  effective.div = clamp(effective.div, 1, 16);
  effective.prob = clamp(effective.prob, 0, 100);
  return effective;
}

export const volumeGain = (value: number) => Math.pow(value / 100, 1.7) * 1.1;
