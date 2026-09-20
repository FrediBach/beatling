export const BLOCK_COUNT = 16;

export type VoiceId =
  | "kick"
  | "snare"
  | "clap"
  | "rim"
  | "ch"
  | "oh"
  | "lt"
  | "mt"
  | "ht"
  | "cow"
  | "cym"
  | "shk";

export type Machine = "808" | "909";
export type LfoShape = "ramp" | "tri" | "sqr" | "rnd";
export type ModDestination = "" | "pulses" | "rot" | "prob" | "div" | "tune" | "decay" | "level";
export type ClockSource = "G" | `${number}`;
export type ResetSource = "" | "G" | "BAR" | `${number}`;
export type BlockSource = "" | `${number}`;
export type BlockParam = "steps" | "pulses" | "rot" | "div" | "prob";
export type BlockRandomizationLocks = Record<BlockParam, boolean>;

export interface SequencerBlock {
  voice: VoiceId | "";
  steps: number;
  pulses: number;
  rot: number;
  div: number;
  prob: number;
  gate: number;
  clk: ClockSource[];
  rst: ResetSource;
  mut: BlockSource;
  mute: boolean;
  modSrc: BlockSource;
  modDst: ModDestination;
  modAmt: number;
  shape: LfoShape;
}

export interface VoiceState {
  machine: Machine;
  level: number;
  tune: number;
  decay: number;
  mute: boolean;
}

export type VoiceBank = Record<VoiceId, VoiceState>;

export interface Patch {
  format: "euclid-grid.v1";
  bpm: number;
  rate: number;
  swing: number;
  vol: number;
  blocks: SequencerBlock[];
  voices: VoiceBank;
}

export interface EffectiveBlock {
  steps: number;
  pulses: number;
  rot: number;
  div: number;
  prob: number;
  tune: number;
  decay: number;
  level: number;
  mod: number;
}

export interface BlockVisualState {
  position: number;
  lfo: number;
  fire: boolean;
  muted: boolean;
  effective: Pick<EffectiveBlock, "steps" | "pulses" | "rot">;
}

export interface EngineSnapshot {
  blocks: BlockVisualState[];
  activeVoices: Partial<Record<VoiceId, boolean>>;
}
