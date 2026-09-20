import { euclidHit } from "@/lib/euclid";
import { createBlock, createVoices } from "@/lib/patch";
import { BLOCK_COUNT, type Machine, type Patch, type SequencerBlock, type VoiceBank, type VoiceId } from "@/lib/types";

interface PresetLane {
  voice: VoiceId;
  hits: number[];
  steps?: 16 | 32;
}

export interface DrumPreset {
  id: string;
  name: string;
  category: string;
  bpm: number;
  swing: number;
  machine: Machine;
  rate?: 4 | 8;
  lanes: PresetLane[];
  machineOverrides?: Partial<Record<VoiceId, Machine>>;
}

const lane = (voice: VoiceId, hits: number[], steps: 16 | 32 = 16): PresetLane => ({ voice, hits, steps });
const all = Array.from({ length: 16 }, (_, index) => index);
const eighths = [0, 2, 4, 6, 8, 10, 12, 14];
const quarters = [0, 4, 8, 12];
const offbeats = [2, 6, 10, 14];
const doubled = (hits: number[]) => hits.map((hit) => hit * 2);
const swingDepth = (ratio: number) => Math.round((ratio - 50) * 2);

export const DRUM_PRESETS: DrumPreset[] = [
  { id: "electro-backbeat", name: "Electro Backbeat", category: "Electro", bpm: 118, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 6, 8, 14]), lane("snare", [4, 12]), lane("clap", [4, 12]), lane("ch", eighths), lane("cow", offbeats)] },
  { id: "electro-funk-maracas", name: "Electro-Funk with Maracas", category: "Electro", bpm: 112, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 7, 10]), lane("clap", [4, 12]), lane("shk", all), lane("mt", [6, 14]), lane("lt", [7, 15]), lane("cow", [8])] },
  { id: "stripped-808-breakbeat", name: "Stripped 808 Breakbeat", category: "Electro", bpm: 104, swing: swingDepth(54), machine: "808", lanes: [lane("kick", [0, 6, 10]), lane("snare", [4, 11, 12]), lane("ch", [0, 2, 4, 6, 8, 10, 12, 14, 15]), lane("oh", [14])] },

  { id: "bass-tempo-standard", name: "Bass Tempo Standard", category: "Miami Bass", bpm: 135, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 6, 10, 14]), lane("clap", [4, 12]), lane("ch", all), lane("oh", [14]), lane("cow", offbeats)] },
  { id: "double-time-bass", name: "Double-Time Bass", category: "Miami Bass", bpm: 145, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 3, 6, 8, 11, 14]), lane("snare", [4, 12]), lane("ch", all), lane("shk", [1, 3, 5, 7, 9, 11, 13, 15]), lane("cym", [0], 32)] },
  { id: "half-time-bass-groove", name: "Half-Time Bass Groove", category: "Miami Bass", bpm: 142, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 6, 13]), lane("clap", [8]), lane("ch", all), lane("oh", [3, 11])] },

  { id: "boom-bap", name: "Boom Bap", category: "Hip Hop", bpm: 90, swing: swingDepth(58), machine: "808", lanes: [lane("kick", [0, 6, 10]), lane("snare", [4, 12]), lane("ch", [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]), lane("oh", [14])] },
  { id: "sparse-808-ballad", name: "Sparse 808 Ballad", category: "Hip Hop", bpm: 78, swing: swingDepth(54), machine: "808", lanes: [lane("kick", [0, 10]), lane("clap", [4, 12]), lane("ch", offbeats), lane("lt", [14, 15])] },
  { id: "modern-808-hip-hop", name: "Modern 808 Hip Hop", category: "Hip Hop", bpm: 84, swing: swingDepth(56), machine: "808", lanes: [lane("kick", [0, 6, 10]), lane("snare", [4, 12]), lane("rim", [2, 10]), lane("ch", [0, 2, 4, 5, 6, 8, 10, 12, 13, 14]), lane("oh", [8])] },

  { id: "trap-standard", name: "Trap Standard", category: "Trap & Drill", bpm: 140, swing: swingDepth(50), machine: "808", rate: 8, lanes: [lane("kick", doubled([0, 6, 12]), 32), lane("snare", [16], 32), lane("clap", [16], 32), lane("ch", [...doubled(all), 13, 29], 32), lane("oh", [22], 32)] },
  { id: "triplet-trap", name: "Triplet Trap", category: "Trap & Drill", bpm: 144, swing: swingDepth(66.7), machine: "808", lanes: [lane("kick", [0, 5, 12]), lane("snare", [8]), lane("ch", all), lane("rim", [6, 14])] },
  { id: "drill-variant", name: "Drill Variant", category: "Trap & Drill", bpm: 142, swing: swingDepth(58), machine: "808", rate: 8, lanes: [lane("kick", doubled([0, 8]), 32), lane("snare", [16], 32), lane("rim", [8], 32), lane("ch", [...doubled(eighths), 13, 29], 32)] },

  { id: "basic-house", name: "Basic House", category: "Chicago House", bpm: 122, swing: swingDepth(50), machine: "909", machineOverrides: { clap: "808" }, lanes: [lane("kick", quarters), lane("clap", [4, 12]), lane("ch", offbeats)] },
  { id: "open-hat-house", name: "Open-Hat House", category: "Chicago House", bpm: 124, swing: swingDepth(50), machine: "909", machineOverrides: { clap: "808" }, lanes: [lane("kick", quarters), lane("clap", [4, 12]), lane("ch", quarters), lane("oh", offbeats)] },
  { id: "deep-house-shuffle", name: "Deep House Shuffle", category: "Chicago House", bpm: 120, swing: swingDepth(57), machine: "909", machineOverrides: { clap: "808" }, lanes: [lane("kick", quarters), lane("clap", [4, 12]), lane("ch", [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]), lane("oh", offbeats), lane("rim", [7, 15])] },
  { id: "jackin-house", name: "Jackin' House", category: "Chicago House", bpm: 126, swing: swingDepth(54), machine: "909", machineOverrides: { clap: "808", cow: "808" }, lanes: [lane("kick", [0, 4, 8, 11, 12]), lane("clap", [4, 12]), lane("ch", eighths), lane("oh", offbeats), lane("cow", [6, 14])] },

  { id: "acid-basic", name: "Acid Basic", category: "Acid House", bpm: 120, swing: swingDepth(50), machine: "909", lanes: [lane("kick", quarters), lane("clap", [4, 12]), lane("ch", all), lane("oh", [6, 14])] },
  { id: "acid-tom-fill", name: "Acid with Tom Fill", category: "Acid House", bpm: 122, swing: swingDepth(50), machine: "909", lanes: [lane("kick", [0, 4, 8, 12, 16, 20, 24], 32), lane("clap", [4, 12, 20], 32), lane("ch", Array.from({ length: 24 }, (_, index) => index), 32), lane("ht", [24, 26], 32), lane("mt", [28], 32), lane("lt", [30, 31], 32)] },
  { id: "hypnotic-acid", name: "Hypnotic Acid", category: "Acid House", bpm: 128, swing: swingDepth(50), machine: "909", lanes: [lane("kick", quarters), lane("ch", eighths), lane("oh", [12]), lane("rim", [3, 11])] },

  { id: "detroit-syncopated-clap", name: "Detroit Syncopated Clap", category: "Detroit Techno", bpm: 130, swing: swingDepth(50), machine: "909", lanes: [lane("kick", quarters), lane("clap", [4, 7, 12]), lane("ch", eighths), lane("oh", offbeats), lane("cym", all)] },
  { id: "rolling-techno", name: "Rolling Techno", category: "Detroit Techno", bpm: 133, swing: swingDepth(52), machine: "909", lanes: [lane("kick", [0, 4, 8, 14]), lane("snare", [4, 12]), lane("cym", [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]), lane("oh", [10]), lane("rim", [2, 13])] },
  { id: "tom-driven-techno", name: "Tom-Driven Techno", category: "Detroit Techno", bpm: 132, swing: swingDepth(50), machine: "909", lanes: [lane("kick", quarters), lane("clap", [8]), lane("lt", [2, 10]), lane("mt", [6, 14]), lane("ht", [3, 11]), lane("ch", eighths)] },
  { id: "minimal-dub-techno", name: "Minimal / Dub Techno", category: "Detroit Techno", bpm: 125, swing: swingDepth(50), machine: "909", lanes: [lane("kick", quarters), lane("ch", offbeats), lane("rim", [10]), lane("oh", [14])] },

  { id: "rave-stomp", name: "Rave Stomp", category: "Rave & Hard Techno", bpm: 140, swing: swingDepth(50), machine: "909", lanes: [lane("kick", quarters), lane("ch", eighths), lane("oh", offbeats), lane("clap", [4, 12]), lane("cym", [0])] },
  { id: "hardgroove", name: "Hardgroove", category: "Rave & Hard Techno", bpm: 138, swing: swingDepth(54), machine: "909", lanes: [lane("kick", quarters), lane("cym", [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]), lane("rim", [3, 6, 11, 14]), lane("clap", [8]), lane("oh", [12])] },
  { id: "offbeat-kick-techno", name: "Offbeat-Kick Techno", category: "Rave & Hard Techno", bpm: 142, swing: swingDepth(50), machine: "909", lanes: [lane("kick", [0, 4, 10, 12]), lane("ch", all), lane("oh", [6, 14]), lane("clap", [8])] },
  { id: "gabber-adjacent", name: "Gabber-Adjacent", category: "Rave & Hard Techno", bpm: 165, swing: swingDepth(50), machine: "909", lanes: [lane("kick", eighths), lane("snare", [8]), lane("cym", [0])] },

  { id: "two-step", name: "2-Step", category: "UK Garage", bpm: 135, swing: swingDepth(64), machine: "909", lanes: [lane("kick", [0, 7, 10]), lane("snare", [4, 12]), lane("ch", [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]), lane("oh", [6]), lane("rim", [11])] },
  { id: "speed-garage", name: "Speed Garage", category: "UK Garage", bpm: 132, swing: swingDepth(58), machine: "909", lanes: [lane("kick", quarters), lane("snare", [4, 10, 12]), lane("ch", [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]), lane("oh", offbeats)] },
  { id: "future-garage", name: "Future Garage / Bass", category: "UK Garage", bpm: 138, swing: swingDepth(62), machine: "909", lanes: [lane("kick", [0, 10]), lane("snare", [8]), lane("rim", [4, 14]), lane("ch", [0, 3, 4, 7, 8, 11, 12, 15]), lane("oh", [12])] },

  { id: "slow-808-soul", name: "Slow 808 Soul", category: "R&B & Synth-Pop", bpm: 94, swing: swingDepth(56), machine: "808", lanes: [lane("kick", [0, 10]), lane("rim", [4, 12]), lane("cow", [2, 10]), lane("mt", [6, 14]), lane("lt", [7, 15]), lane("shk", eighths)] },
  { id: "synth-pop-mid-tempo", name: "Synth-Pop Mid-Tempo", category: "R&B & Synth-Pop", bpm: 116, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 8]), lane("snare", [4, 12]), lane("clap", [4, 12]), lane("ch", eighths), lane("cym", [0])] },
  { id: "contemporary-rnb", name: "Contemporary R&B", category: "R&B & Synth-Pop", bpm: 72, swing: swingDepth(60), machine: "808", lanes: [lane("kick", [0, 10]), lane("clap", [8]), lane("ch", [2, 6, 10, 13, 14]), lane("rim", [14])] },

  { id: "dembow", name: "Dembow", category: "Dancehall & Reggaeton", bpm: 96, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 3, 6, 8, 11, 14]), lane("snare", [4, 7, 12, 15]), lane("ch", eighths)] },
  { id: "reggaeton", name: "Reggaeton", category: "Dancehall & Reggaeton", bpm: 92, swing: swingDepth(50), machine: "808", lanes: [lane("kick", [0, 3, 6, 8, 11, 14]), lane("snare", [3, 7, 11, 15]), lane("shk", all), lane("oh", [14])] },
  { id: "dancehall", name: "Dancehall", category: "Dancehall & Reggaeton", bpm: 100, swing: swingDepth(54), machine: "808", lanes: [lane("kick", [0, 8, 11]), lane("rim", [4, 12]), lane("ch", [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]), lane("mt", [6, 14])] },
  { id: "afrobeats-amapiano", name: "Afrobeats / Amapiano-Adjacent", category: "Dancehall & Reggaeton", bpm: 112, swing: swingDepth(56), machine: "808", lanes: [lane("kick", [0, 3, 6, 8, 14]), lane("rim", [4, 12]), lane("lt", [2, 5, 10, 13]), lane("shk", [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]), lane("ch", offbeats)] },

  { id: "machine-breakbeat", name: "Machine Breakbeat", category: "Breakbeat", bpm: 130, swing: swingDepth(54), machine: "909", machineOverrides: { kick: "808" }, lanes: [lane("kick", [0, 6, 11]), lane("snare", [3, 4, 9, 12, 15]), lane("ch", eighths), lane("oh", [14])] },
  { id: "big-beat", name: "Big Beat", category: "Breakbeat", bpm: 122, swing: swingDepth(56), machine: "909", lanes: [lane("kick", [0, 6, 8]), lane("snare", [4, 11, 12]), lane("ch", [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]), lane("cym", [0])] },
  { id: "jungle-half-time", name: "Jungle-Adjacent Half-Time", category: "Breakbeat", bpm: 168, swing: swingDepth(52), machine: "909", machineOverrides: { kick: "808" }, lanes: [lane("kick", [0, 10]), lane("snare", [8]), lane("rim", [6, 14]), lane("ch", eighths)] },
];

export const PRESET_GROUPS = [...new Set(DRUM_PRESETS.map((preset) => preset.category))].map((category) => ({
  category,
  presets: DRUM_PRESETS.filter((preset) => preset.category === category),
}));

interface EuclideanPart {
  steps: number;
  pulses: number;
  rot: number;
  mask: bigint;
}

const bitCount = (mask: bigint) => {
  let count = 0;
  for (let value = mask; value; value >>= 1n) count += Number(value & 1n);
  return count;
};

const hitMask = (hits: number[]) => hits.reduce((mask, hit) => mask | (1n << BigInt(hit)), 0n);

function euclideanCandidates(steps: number, target: bigint): EuclideanPart[] {
  const unique = new Map<string, EuclideanPart>();
  for (let pulses = 1; pulses <= steps; pulses += 1) {
    for (let rot = 0; rot < steps; rot += 1) {
      let mask = 0n;
      for (let index = 0; index < steps; index += 1) {
        if (euclidHit(index, steps, pulses, rot)) mask |= 1n << BigInt(index);
      }
      if ((mask & target) !== mask) continue;
      const key = mask.toString();
      if (!unique.has(key)) unique.set(key, { steps, pulses, rot, mask });
    }
  }
  return [...unique.values()].sort((a, b) => bitCount(b.mask) - bitCount(a.mask));
}

function decomposeLane(laneDefinition: PresetLane): EuclideanPart[] {
  const steps = laneDefinition.steps ?? 16;
  const target = hitMask(laneDefinition.hits);
  if (!target) return [];
  const candidates = euclideanCandidates(steps, target);
  const memo = new Map<string, EuclideanPart[] | null>();
  const solve = (remaining: bigint): EuclideanPart[] | null => {
    if (!remaining) return [];
    const key = remaining.toString();
    if (memo.has(key)) return memo.get(key)!;
    const first = remaining & -remaining;
    let best: EuclideanPart[] | null = null;
    for (const candidate of candidates) {
      if (!(candidate.mask & first) || (candidate.mask & remaining) !== candidate.mask) continue;
      const rest = solve(remaining ^ candidate.mask);
      if (rest && (!best || rest.length + 1 < best.length)) best = [candidate, ...rest];
    }
    memo.set(key, best);
    return best;
  };
  return solve(target) ?? [];
}

function applyPresetCharacter(preset: DrumPreset, voices: VoiceBank) {
  for (const voice of Object.values(voices)) voice.machine = preset.machine;
  for (const [voice, machine] of Object.entries(preset.machineOverrides ?? {})) {
    voices[voice as VoiceId].machine = machine;
  }
  if (["Miami Bass", "Hip Hop", "Trap & Drill"].includes(preset.category)) {
    Object.assign(voices.kick, { decay: 92, tune: -4, level: 92 });
  }
  if (preset.category === "R&B & Synth-Pop") {
    Object.assign(voices.kick, { decay: 82, tune: -2, level: 82 });
    Object.assign(voices.rim, { level: 64 });
    Object.assign(voices.cow, { level: 60 });
    Object.assign(voices.lt, { level: 62 });
    Object.assign(voices.mt, { level: 62 });
  }
  if (["Chicago House", "Acid House", "Detroit Techno", "Rave & Hard Techno", "UK Garage"].includes(preset.category)) {
    Object.assign(voices.kick, { decay: preset.category === "Rave & Hard Techno" ? 38 : 52, tune: preset.category === "Rave & Hard Techno" ? 4 : 0, level: 90 });
    Object.assign(voices.oh, { decay: 72, level: 72 });
    Object.assign(voices.ch, { decay: 42, level: 68 });
  }
}

function patternedBlock(index: number, voice: VoiceId | "", steps: number, hits: number[]): SequencerBlock {
  const [part] = decomposeLane({ voice: voice || "kick", hits, steps: steps as 16 | 32 });
  if (!part) throw new Error(`Could not create ${steps}-step Euclidean component`);
  const block = createBlock(index);
  block.voice = voice;
  block.steps = part.steps;
  block.pulses = part.pulses;
  block.rot = part.rot;
  block.prob = 100;
  return block;
}

function createAcidTomFillBlocks(): SequencerBlock[] {
  const blocks: SequencerBlock[] = [];
  const finalBackbeatGate = patternedBlock(0, "", 32, [28]);
  finalBackbeatGate.gate = 100;
  blocks.push(finalBackbeatGate);
  const secondHalfGate = patternedBlock(1, "", 32, [24]);
  secondHalfGate.gate = 800;
  blocks.push(secondHalfGate);
  const kick = patternedBlock(2, "kick", 16, quarters);
  kick.mut = "0";
  blocks.push(kick);
  const clap = patternedBlock(3, "clap", 16, [4, 12]);
  clap.mut = "0";
  blocks.push(clap);
  const hats = patternedBlock(4, "ch", 16, all);
  hats.mut = "1";
  blocks.push(hats);
  blocks.push(patternedBlock(5, "ht", 32, [24]));
  blocks.push(patternedBlock(6, "ht", 32, [26]));
  blocks.push(patternedBlock(7, "mt", 32, [28]));
  blocks.push(patternedBlock(8, "lt", 32, [30]));
  blocks.push(patternedBlock(9, "lt", 32, [31]));
  while (blocks.length < BLOCK_COUNT) {
    const block = createBlock(blocks.length);
    block.voice = "";
    block.pulses = 0;
    blocks.push(block);
  }
  return blocks;
}

export function createPresetPatch(id: string, volume = 72): Patch {
  const preset = DRUM_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  const components = preset.lanes.flatMap((presetLane) => decomposeLane(presetLane).map((part) => ({ voice: presetLane.voice, part })));
  if (preset.id !== "acid-tom-fill" && components.length > BLOCK_COUNT) throw new Error(`${preset.name} requires ${components.length} blocks`);
  const blocks: SequencerBlock[] = preset.id === "acid-tom-fill" ? createAcidTomFillBlocks() : Array.from({ length: BLOCK_COUNT }, (_, index) => {
    const block = createBlock(index);
    const component = components[index];
    if (!component) {
      block.voice = "";
      block.pulses = 0;
      return block;
    }
    block.voice = component.voice;
    block.steps = component.part.steps;
    block.pulses = component.part.pulses;
    block.rot = component.part.rot;
    block.prob = 100;
    return block;
  });
  const voices = createVoices();
  applyPresetCharacter(preset, voices);
  return {
    format: "euclid-grid.v1",
    bpm: preset.bpm,
    rate: preset.rate ?? 4,
    swing: preset.swing,
    vol: volume,
    blocks,
    voices,
  };
}
