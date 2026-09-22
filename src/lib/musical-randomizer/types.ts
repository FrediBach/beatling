import type { Patch, VoiceId } from "@/lib/types";

export type GrooveProfile = "steady" | "broken" | "halftime" | "rolling";
export type Intensity = 0 | 1 | 2;
export interface MusicalRequest {
  mode: "new" | "reshape";
  profile: GrooveProfile;
  density: Intensity;
  syncopation: Intensity;
  development: Intensity;
  change: Intensity;
  swing: "keep" | "straight" | "light" | "strong";
  bpm: number;
  parts: VoiceId[];
  keep: VoiceId[];
  harmony: "keep" | "shared";
  root: number;
  scale: number;
  reshapeMelody: boolean;
}

export interface MusicalCandidate {
  patch: Patch;
  seed: number;
  version: 1;
  summary: string;
  changedParts: VoiceId[];
  notices: string[];
}

export type GenerationResult = { candidate: MusicalCandidate; error?: never } | { candidate?: never; error: string };

export const DEFAULT_PARTS: VoiceId[] = ["kick", "snare", "ch", "oh", "rim", "shk", "bassline", "lead"];

export function defaultRequest(patch: Patch, mode: MusicalRequest["mode"] = "new"): MusicalRequest {
  return {
    mode, profile: "steady", density: 1, syncopation: 1, development: 1, change: 1,
    swing: mode === "new" ? "straight" : "keep", bpm: mode === "new" ? 122 : patch.bpm,
    parts: mode === "new" ? [...DEFAULT_PARTS] : [...new Set(patch.blocks.flatMap((block) => block.kind === "bernoulli" ? block.branchVoices : block.voice ? [block.voice] : []))],
    keep: [], harmony: mode === "new" ? "shared" : "keep",
    root: patch.voices.bassline.custom.root ?? 0,
    scale: mode === "new" ? 2 : patch.voices.bassline.custom.scale ?? 2,
    reshapeMelody: false,
  };
}
