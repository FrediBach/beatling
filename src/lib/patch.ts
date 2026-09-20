import { BLOCK_COUNT, type BlockParam, type BlockRandomizationLocks, type Patch, type SequencerBlock, type VoiceBank, type VoiceId, type VoiceState } from "@/lib/types";
import { ROW_PARAMS, VOICE_DEFS } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import { createCustomVoiceSettings, normalizeCustomVoiceSettings } from "@/lib/voice-config";
import { createEffects, normalizeEffects } from "@/lib/effects";

const STORAGE_KEY = "egs.patch.v2";
const LEGACY_STORAGE_KEY = "egs.patch.v1";

export function createBlock(index: number): SequencerBlock {
  return {
    voice: VOICE_DEFS[index]?.id ?? "",
    steps: 16,
    pulses: 0,
    rot: 0,
    div: 1,
    prob: 100,
    gate: 50,
    clk: ["G"],
    rst: "",
    mut: "",
    mute: false,
    modSrc: "",
    modDst: "",
    modAmt: 0,
    shape: "ramp",
  };
}

export function createVoice(id: VoiceId): VoiceState {
  return {
    machine: ["kick", "snare", "ch", "oh"].includes(id) ? "909" : "808",
    level: 78,
    tune: 0,
    decay: 50,
    mute: false,
    custom: createCustomVoiceSettings(id),
  };
}

export function createVoices(): VoiceBank {
  return Object.fromEntries(VOICE_DEFS.map(({ id }) => [id, createVoice(id)])) as VoiceBank;
}

const DEMO = [
  { v: "kick", st: 16, pu: 4, ro: 0, dv: 1, pr: 100 },
  { v: "snare", st: 16, pu: 2, ro: 4, dv: 1, pr: 100 },
  { v: "ch", st: 16, pu: 8, ro: 0, dv: 1, pr: 92, mod: { src: "12", dst: "prob", amt: -0.5 } },
  { v: "oh", st: 16, pu: 3, ro: 2, dv: 1, pr: 60 },
  { v: "clap", st: 16, pu: 3, ro: 6, dv: 1, pr: 75, mut: "15" },
  { v: "rim", st: 12, pu: 5, ro: 1, dv: 1, pr: 55 },
  { v: "lt", st: 16, pu: 2, ro: 9, dv: 1, pr: 45, rst: "15" },
  { v: "mt", st: 10, pu: 3, ro: 0, dv: 1, pr: 40 },
  { v: "ht", st: 14, pu: 5, ro: 3, dv: 1, pr: 35 },
  { v: "cow", st: 16, pu: 3, ro: 5, dv: 2, pr: 40, clk: ["G", "1"] },
  { v: "cym", st: 4, pu: 1, ro: 0, dv: 1, pr: 70, clk: ["0"] },
  { v: "shk", st: 16, pu: 11, ro: 0, dv: 1, pr: 80, mod: { src: "13", dst: "level", amt: 0.6 } },
  { v: "", st: 8, pu: 3, ro: 0, dv: 2, pr: 100, shape: "tri" },
  { v: "", st: 6, pu: 5, ro: 0, dv: 1, pr: 100, shape: "rnd" },
  { v: "", st: 5, pu: 2, ro: 0, dv: 3, pr: 100, shape: "ramp" },
  { v: "", st: 4, pu: 1, ro: 0, dv: 8, pr: 100, gate: 200, shape: "sqr" },
] as const;

export function createDemoPatch(volume = 72): Patch {
  const blocks = DEMO.map((demo, index) => {
    const block = createBlock(index);
    block.voice = demo.v;
    block.steps = demo.st;
    block.pulses = demo.pu;
    block.rot = demo.ro;
    block.div = demo.dv;
    block.prob = demo.pr;
    if ("gate" in demo) block.gate = demo.gate;
    if ("shape" in demo) block.shape = demo.shape;
    if ("clk" in demo) block.clk = [...demo.clk];
    if ("rst" in demo) block.rst = demo.rst;
    if ("mut" in demo) block.mut = demo.mut;
    if ("mod" in demo) {
      block.modSrc = demo.mod.src;
      block.modDst = demo.mod.dst;
      block.modAmt = demo.mod.amt;
    }
    return block;
  });
  return { format: "euclid-grid.v2", bpm: 124, rate: 4, swing: 12, vol: volume, blocks, voices: createVoices(), effects: createEffects() };
}

export function createEmptyPatch(volume = 72): Patch {
  return {
    format: "euclid-grid.v2",
    bpm: 124,
    rate: 4,
    swing: 0,
    vol: volume,
    blocks: Array.from({ length: BLOCK_COUNT }, (_, index) => createBlock(index)),
    voices: createVoices(),
    effects: createEffects(),
  };
}

export function normalizePatch(value: unknown): Patch | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<Patch>;
  if (!Array.isArray(input.blocks)) return null;
  const base = createEmptyPatch(typeof input.vol === "number" ? input.vol : 72);
  base.bpm = clamp(Math.round(Number(input.bpm) || 124), 20, 300);
  base.rate = [2, 4, 6, 8].includes(Number(input.rate)) ? Number(input.rate) : 4;
  base.swing = clamp(Number(input.swing) || 0, 0, 70);
  base.vol = clamp(Number(input.vol) || 0, 0, 100);
  base.blocks = base.blocks.map((fallback, index) => {
    const source = input.blocks?.[index];
    if (!source || typeof source !== "object") return fallback;
    return { ...fallback, ...source, clk: Array.isArray(source.clk) ? [...source.clk] : [...fallback.clk] };
  });
  if (input.voices) {
    for (const { id } of VOICE_DEFS) {
      const source = input.voices[id];
      if (!source) continue;
      base.voices[id] = {
        ...base.voices[id],
        ...source,
        machine: ["808", "909", "custom"].includes(source.machine) ? source.machine : base.voices[id].machine,
        custom: normalizeCustomVoiceSettings(id, source.custom),
      };
    }
  }
  base.effects = normalizeEffects(input.effects);
  return base;
}

export function loadStoredPatch(): Patch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizePatch(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function savePatch(patch: Patch): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patch));
  } catch {
    // Storage can be unavailable in privacy mode; the sequencer remains usable.
  }
}

export function createRandomizationLocks(locked = false): BlockRandomizationLocks[] {
  return Array.from({ length: BLOCK_COUNT }, () => Object.fromEntries(ROW_PARAMS.map((parameter) => [parameter, locked])) as BlockRandomizationLocks);
}

const STEP_SIZES = [8, 10, 12, 14, 16, 16, 16, 16];
const DIVISIONS = [1, 1, 1, 1, 2, 2, 3, 4, 8];

export function randomizeBlock(block: SequencerBlock, index: number, locks: BlockRandomizationLocks, random = Math.random): SequencerBlock {
  const next = { ...block, clk: [...block.clk] };
  if (!locks.steps) {
    const sizes = locks.pulses ? STEP_SIZES.filter((size) => size >= block.pulses) : STEP_SIZES;
    if (sizes.length > 0) next.steps = sizes[Math.floor(random() * sizes.length)];
  }
  if (!locks.pulses) {
    next.pulses = Math.floor(random() * (next.steps * 0.7)) + (index === 0 ? 3 : 0);
    next.pulses = clamp(next.pulses, 0, next.steps);
  }
  if (!locks.rot) next.rot = Math.floor(random() * next.steps);
  if (!locks.div) next.div = DIVISIONS[Math.floor(random() * DIVISIONS.length)];
  if (!locks.prob) next.prob = 40 + Math.floor(random() * 61);
  return next;
}

export function randomizeBlockParameter(block: SequencerBlock, index: number, parameter: BlockParam, random = Math.random): SequencerBlock {
  const locks = Object.fromEntries(ROW_PARAMS.map((item) => [item, item !== parameter])) as BlockRandomizationLocks;
  return randomizeBlock(block, index, locks, random);
}

export function shufflePatch(patch: Patch, random = Math.random, locks = createRandomizationLocks()): Patch {
  const blocks = patch.blocks.map((source, index) => {
    const blockLocks = locks[index] ?? createRandomizationLocks()[0];
    const block = randomizeBlock(source, index, blockLocks, random);
    // Keep the first lane as a dependable four-on-the-floor anchor during a full shuffle.
    if (index === 0) {
      if (!blockLocks.steps) block.steps = 16;
      if (!blockLocks.pulses) block.pulses = 4;
      if (!blockLocks.rot) block.rot = 0;
    }
    return block;
  });
  return { ...patch, blocks };
}
