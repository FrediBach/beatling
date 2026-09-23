import type { CustomVoiceSettings, EffectiveBlock } from "@/lib/types";
import { euclidHit } from "./euclid";

export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"] as const;

export const SCALE_DEFS = [
  { name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: "Minor pentatonic", intervals: [0, 3, 5, 7, 10] },
] as const;

export interface QuantizedNote {
  midi: number;
  frequency: number;
  name: string;
  offset: number;
}

function nearestOffset(rawOffset: number, intervals: readonly number[]): number {
  if (!intervals.length) return rawOffset;
  let offset = 0;
  let distance = Number.POSITIVE_INFINITY;
  const centerOctave = Math.floor(rawOffset / 12);
  for (let octaveOffset = centerOctave - 1; octaveOffset <= centerOctave + 1; octaveOffset += 1) {
    for (const interval of intervals) {
      const candidate = octaveOffset * 12 + interval;
      const candidateDistance = Math.abs(rawOffset - candidate);
      if (candidateDistance < distance || (candidateDistance === distance && candidate < offset)) {
        offset = candidate;
        distance = candidateDistance;
      }
    }
  }
  return offset;
}

/** One octave divided into Steps; 12 gives semitones, other sizes give equal temperaments. */
export function euclideanScale(rhythm: Pick<EffectiveBlock, "steps" | "pulses" | "rot">): number[] {
  return Array.from({ length: rhythm.steps }, (_, step) => step)
    .filter((step) => euclidHit(step, rhythm.steps, rhythm.pulses, rhythm.rot))
    .map((step) => step * 12 / rhythm.steps);
}

export function quantizeEuclideanCv(rhythm: Pick<EffectiveBlock, "steps" | "pulses" | "rot">, cv: number): number {
  return nearestOffset(cv * 12, euclideanScale(rhythm)) / 12;
}

export function quantizeVoiceCv(settings: CustomVoiceSettings, vOct: number, tune = 0): QuantizedNote {
  const root = Math.round(settings.root ?? 0);
  const octave = Math.round(settings.octave ?? 3);
  const scale = SCALE_DEFS[Math.round(settings.scale ?? 0)] ?? SCALE_DEFS[0];
  const offset = settings.quantizer === 0 ? vOct * 12 : nearestOffset(vOct * 12, scale.intervals);
  const midi = (octave + 1) * 12 + root + offset + tune;
  const roundedMidi = Math.round(midi);
  const noteName = NOTE_NAMES[((roundedMidi % 12) + 12) % 12];
  const noteOctave = Math.floor(roundedMidi / 12) - 1;
  return { midi, frequency: 440 * 2 ** ((midi - 69) / 12), name: `${noteName}${noteOctave}`, offset };
}
