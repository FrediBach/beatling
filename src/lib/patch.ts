import { BLOCK_COUNT, type Patch, type SequencerBlock, type VoiceBank, type VoiceId, type VoiceState } from "@/lib/types";
import { VOICE_DEFS } from "@/lib/constants";
import { clamp } from "@/lib/euclid";

const STORAGE_KEY = "egs.patch.v1";

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
  return { format: "euclid-grid.v1", bpm: 124, rate: 4, swing: 12, vol: volume, blocks, voices: createVoices() };
}

export function createEmptyPatch(volume = 72): Patch {
  return {
    format: "euclid-grid.v1",
    bpm: 124,
    rate: 4,
    swing: 0,
    vol: volume,
    blocks: Array.from({ length: BLOCK_COUNT }, (_, index) => createBlock(index)),
    voices: createVoices(),
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
      if (input.voices[id]) base.voices[id] = { ...base.voices[id], ...input.voices[id] };
    }
  }
  return base;
}

export function loadStoredPatch(): Patch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export function shufflePatch(patch: Patch, random = Math.random): Patch {
  const sizes = [8, 12, 16, 16, 16, 10, 14, 16];
  const blocks = patch.blocks.map((source, index) => {
    const block = { ...source, clk: [...source.clk] };
    block.steps = sizes[Math.floor(random() * sizes.length)];
    block.pulses = Math.floor(random() * (block.steps * 0.7)) + (index === 0 ? 3 : 0);
    block.pulses = clamp(block.pulses, 0, block.steps);
    block.rot = Math.floor(random() * block.steps);
    block.prob = 40 + Math.floor(random() * 61);
    if (index === 0) Object.assign(block, { steps: 16, pulses: 4, rot: 0 });
    return block;
  });
  return { ...patch, blocks };
}
