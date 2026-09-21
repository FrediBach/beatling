import type { BlockParam, LfoShape, ModDestination, SequencerBlock, VoiceId } from "@/lib/types";

export interface VoiceDefinition {
  id: VoiceId;
  name: string;
  tag: string;
  family: "drum" | "synth";
  model?: "303" | "101";
}

export const VOICE_DEFS: VoiceDefinition[] = [
  { id: "kick", name: "Kick", tag: "BD", family: "drum" },
  { id: "snare", name: "Snare", tag: "SD", family: "drum" },
  { id: "clap", name: "Clap", tag: "CP", family: "drum" },
  { id: "rim", name: "Rim", tag: "RS", family: "drum" },
  { id: "ch", name: "Closed hat", tag: "CH", family: "drum" },
  { id: "oh", name: "Open hat", tag: "OH", family: "drum" },
  { id: "lt", name: "Low tom", tag: "LT", family: "drum" },
  { id: "mt", name: "Mid tom", tag: "MT", family: "drum" },
  { id: "ht", name: "Hi tom", tag: "HT", family: "drum" },
  { id: "cow", name: "Cowbell", tag: "CB", family: "drum" },
  { id: "cym", name: "Cymbal", tag: "CY", family: "drum" },
  { id: "shk", name: "Shaker", tag: "MA", family: "drum" },
  { id: "bassline", name: "Bassline", tag: "303", family: "synth", model: "303" },
  { id: "lead", name: "Lead", tag: "101", family: "synth", model: "101" },
];

export const DRUM_VOICE_DEFS = VOICE_DEFS.filter((voice) => voice.family === "drum");
export const SYNTH_VOICE_IDS = new Set<VoiceId>(VOICE_DEFS.filter((voice) => voice.family === "synth").map((voice) => voice.id));

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

export const blockName = (block: SequencerBlock) => block.kind === "bernoulli" ? "Bernoulli gate" : block.kind === "modulator" ? "Modulator" : voiceName(block.voice);
export const blockTag = (block: SequencerBlock) => block.kind === "bernoulli" ? "A/B" : block.kind === "modulator" ? "LFO" : voiceTag(block.voice);
