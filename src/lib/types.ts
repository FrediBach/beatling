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
  | "shk"
  | "bassline"
  | "lead";

export type BlockKind = "voice" | "modulator" | "bernoulli";

export type Machine = "808" | "909" | "custom";
export type EffectId = "distortion" | "reverb" | "delay" | "karplus" | "compressor";
export type CustomVoiceSettings = Record<string, number>;
export type LfoShape = "ramp" | "tri" | "sqr" | "rnd";
export type ModDestination = "" | "pulses" | "rot" | "prob" | "div" | "tune" | "decay" | "level";
export type VoiceModDestination = "tune" | "decay" | "level" | "vOct";
export type ClockSource = "G" | `${number}`;
export type ResetSource = "" | "G" | "BAR" | `${number}`;
export type BlockSource = "" | `${number}`;
export type BlockParam = "steps" | "pulses" | "rot" | "div" | "prob";
export type BlockRandomizationLocks = Record<BlockParam, boolean>;

export interface RhythmPattern {
  id: string;
  steps: number;
  pulses: number;
  rot: number;
  repeats: number;
}

// Each destination is a stable route identity; a block can have all seven targets.
export interface ModulationRoute {
  source: BlockSource;
  destination: Exclude<ModDestination, "">;
  amount: number;
}

export interface VoiceModulationRoute {
  source: BlockSource;
  destination: VoiceModDestination;
  amount: number;
}

export interface EffectiveVoiceModulation {
  tune: number;
  decay: number;
  level: number;
  vOct: number;
}

export interface SequencerBlock {
  kind: BlockKind;
  voice: VoiceId | "";
  branchVoices: [VoiceId, VoiceId];
  steps: number;
  pulses: number;
  rot: number;
  rhythmId: string;
  repeats: number;
  series: RhythmPattern[];
  div: number;
  prob: number;
  gate: number;
  clk: ClockSource[];
  rst: ResetSource;
  mut: BlockSource;
  mute: boolean;
  modulations: ModulationRoute[];
  shape: LfoShape;
}

export interface VoiceState {
  machine: Machine;
  level: number;
  tune: number;
  decay: number;
  mute: boolean;
  modulations: VoiceModulationRoute[];
  custom: CustomVoiceSettings;
}

export type VoiceBank = Record<VoiceId, VoiceState>;

export interface DistortionSettings {
  enabled: boolean;
  drive: number;
  tone: number;
  return: number;
}

export interface ReverbSettings {
  enabled: boolean;
  damping: number;
  return: number;
}

export interface DelaySettings {
  enabled: boolean;
  time: number;
  feedback: number;
  tone: number;
  return: number;
}

export interface CompressorSettings {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  return: number;
}

export type WaveguideModel = "string" | "tube";

export interface KarplusSettings {
  enabled: boolean;
  model: WaveguideModel;
  tune: number;
  body: number;
  decay: number;
  return: number;
}

export type VoiceEffectSends = Record<EffectId, number>;

export interface EffectsState {
  distortion: DistortionSettings;
  reverb: ReverbSettings;
  delay: DelaySettings;
  karplus: KarplusSettings;
  compressor: CompressorSettings;
  sends: Record<VoiceId, VoiceEffectSends>;
}

export interface Patch {
  format: "euclid-grid.v8";
  bpm: number;
  rate: number;
  swing: number;
  vol: number;
  blocks: SequencerBlock[];
  voices: VoiceBank;
  effects: EffectsState;
}

export interface Variation {
  id: string;
  name: string;
  patch: Patch;
}

export interface SongPart {
  id: string;
  variationId: string;
  bars: number;
}

export interface Arrangement {
  format: "euclid-grid.arrangement.v8";
  variations: Variation[];
  songParts: SongPart[];
  activeIndex: number;
  activeSongPartIndex: number;
  songMode: boolean;
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
}

export interface BlockVisualState {
  position: number;
  rhythmIndex?: number;
  lfo: number;
  lfoPosition?: number;
  fire: boolean;
  muted: boolean;
  effective: EffectiveBlock;
}

export interface EngineSnapshot {
  clockPulse: number;
  blocks: BlockVisualState[];
  activeVoices: Partial<Record<VoiceId, boolean>>;
}
