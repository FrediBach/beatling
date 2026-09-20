import type { BlockParam, LfoShape, ModDestination, VoiceId } from "@/lib/types";

export interface VoiceDefinition {
  id: VoiceId;
  name: string;
  tag: string;
}

export const VOICE_DEFS: VoiceDefinition[] = [
  { id: "kick", name: "Kick", tag: "BD" },
  { id: "snare", name: "Snare", tag: "SD" },
  { id: "clap", name: "Clap", tag: "CP" },
  { id: "rim", name: "Rim", tag: "RS" },
  { id: "ch", name: "Closed hat", tag: "CH" },
  { id: "oh", name: "Open hat", tag: "OH" },
  { id: "lt", name: "Low tom", tag: "LT" },
  { id: "mt", name: "Mid tom", tag: "MT" },
  { id: "ht", name: "Hi tom", tag: "HT" },
  { id: "cow", name: "Cowbell", tag: "CB" },
  { id: "cym", name: "Cymbal", tag: "CY" },
  { id: "shk", name: "Shaker", tag: "SH" },
];

export const PARAMS: Record<BlockParam | "gate", { label: string; min: number; max: number; suffix?: string }> = {
  steps: { label: "Steps", min: 1, max: 32 },
  pulses: { label: "Fill", min: 0, max: 32 },
  rot: { label: "Rotate", min: -31, max: 31 },
  div: { label: "Divide", min: 1, max: 16 },
  prob: { label: "Chance", min: 0, max: 100, suffix: "%" },
  gate: { label: "Gate", min: 5, max: 200, suffix: "%" },
};

export const ROW_PARAMS: BlockParam[] = ["steps", "pulses", "rot", "div", "prob"];

export const MOD_DESTS: Array<[ModDestination, string]> = [
  ["", "none"],
  ["pulses", "fill"],
  ["rot", "rotate"],
  ["prob", "chance"],
  ["div", "divide"],
  ["tune", "voice tune"],
  ["decay", "voice decay"],
  ["level", "voice level"],
];

export const LFO_SHAPES: Array<[LfoShape, string]> = [
  ["ramp", "ramp"],
  ["tri", "triangle"],
  ["sqr", "square"],
  ["rnd", "random"],
];

export const RATE_OPTIONS = [
  { value: 2, label: "1/8" },
  { value: 4, label: "1/16" },
  { value: 6, label: "1/8T" },
  { value: 8, label: "1/32" },
];

export const padBlock = (index: number) => String(index + 1).padStart(2, "0");

export const voiceName = (id: VoiceId | "") => VOICE_DEFS.find((voice) => voice.id === id)?.name ?? "";
export const voiceTag = (id: VoiceId | "") => VOICE_DEFS.find((voice) => voice.id === id)?.tag ?? "lfo";
