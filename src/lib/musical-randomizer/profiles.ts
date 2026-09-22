import type { GrooveProfile, MusicalRequest } from "./types";
import type { LfoShape, VoiceId } from "@/lib/types";

export const PROFILES: Record<GrooveProfile, { name: string; bpm: number; description: string; kick: number; backbeat: number }> = {
  steady: { name: "Steady dance", bpm: 122, description: "Four steady kicks, offbeat bass, and an answering lead.", kick: 4, backbeat: 2 },
  broken: { name: "Broken beat", bpm: 112, description: "A broken kick pattern, firm backbeat, and space for a short hook.", kick: 2, backbeat: 2 },
  halftime: { name: "Half-time", bpm: 140, description: "A spacious backbeat with a slower bass foundation.", kick: 2, backbeat: 1 },
  rolling: { name: "Rolling percussion", bpm: 130, description: "A steady low end with interlocking percussion and a sparse lead.", kick: 4, backbeat: 1 },
};

export interface RhythmRecipe { pulses: number; offset: number }
export interface PitchRecipe { steps: number; shape: LfoShape; amount: number }

// Each source begins on phase zero. Sources are allocated before their synths,
// so the first note and every phrase restart hear the same quantized root.
export const BASS_PITCH: readonly PitchRecipe[] = [
  { steps: 32, shape: "sqr", amount: 7 / 12 },
  { steps: 16, shape: "tri", amount: 5 / 12 },
  { steps: 32, shape: "tri", amount: 7 / 12 },
];
export const LEAD_PITCH: readonly PitchRecipe[] = [
  { steps: 16, shape: "tri", amount: 7 / 12 },
  { steps: 16, shape: "ramp", amount: 7 / 12 },
  { steps: 32, shape: "tri", amount: 1 },
];

export function rhythmChoices(voice: VoiceId, request: MusicalRequest): RhythmRecipe[] {
  const { density: d, syncopation: s, profile } = request;
  const definition = PROFILES[profile];
  if (voice === "kick") return [{ pulses: definition.kick, offset: 0 }];
  if (voice === "snare" || voice === "clap") return [{ pulses: definition.backbeat, offset: definition.backbeat === 2 ? 4 : 8 }];
  if (voice === "ch") return [0, 1].map((variant) => ({ pulses: [4, 8, 12][d] + (d === 2 ? variant * 2 : 0), offset: s === 0 ? 0 : variant }));
  if (voice === "shk") return [0, 1, 3].map((offset) => ({ pulses: [2, 4, 8][d], offset: s === 0 ? 0 : offset }));
  if (voice === "oh") return [2, 6, 14].map((offset) => ({ pulses: d === 0 ? 1 : 2, offset }));
  if (voice === "bassline") return [0, 1, 2].map((variant) => ({ pulses: profile === "halftime" ? [1, 2, 4][d] : [2, 4, 6][d], offset: s === 0 ? 0 : profile === "steady" ? 2 : [0, 2, 3][Math.min(s, variant)] }));
  if (voice === "lead") return [1, 3, 7].map((offset) => ({ pulses: [1, 2, 3][d], offset: s === 0 ? 4 : offset }));
  return (s === 0 ? [4, 12] : s === 1 ? [3, 6, 10] : [1, 7, 11, 15]).map((offset) => ({ pulses: [1, 2, 3][d], offset }));
}

export function seededRandom(seed: number, stream = 0): () => number {
  let state = (seed ^ Math.imul(stream + 1, 0x9e3779b9)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}
