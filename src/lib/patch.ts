import { PATCH_FORMAT, BLOCK_COUNT, type BlockKind, type BlockParam, type BlockRandomizationLocks, type Patch, type SequencerBlock, type VoiceBank, type VoiceId, type VoiceState } from "@/lib/types";
import { DRUM_VOICE_DEFS, ROW_PARAMS, SYNTH_VOICE_IDS, VOICE_DEFS } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import { createCustomVoiceSettings, normalizeCustomVoiceSettings } from "@/lib/voice-config";
import { normalizeModulations, normalizeVoiceModulations } from "@/lib/modulation";
import { createEffects, normalizeEffects } from "@/lib/effects";
import { MAX_RHYTHMS, normalizeRhythmPattern } from "@/lib/rhythm-series";

const STORAGE_KEY = "egs.patch.v18";
const V17_STORAGE_KEY = "egs.patch.v17";
const V16_STORAGE_KEY = "egs.patch.v16";
const V15_STORAGE_KEY = "egs.patch.v15";
const V14_STORAGE_KEY = "egs.patch.v14";
const V13_STORAGE_KEY = "egs.patch.v13";
const V12_STORAGE_KEY = "egs.patch.v12";
const V11_STORAGE_KEY = "egs.patch.v11";
const V10_STORAGE_KEY = "egs.patch.v10";
const V9_STORAGE_KEY = "egs.patch.v9";
const V8_STORAGE_KEY = "egs.patch.v8";
const V7_STORAGE_KEY = "egs.patch.v7";
const V6_STORAGE_KEY = "egs.patch.v6";
const V5_STORAGE_KEY = "egs.patch.v5";
const V4_STORAGE_KEY = "egs.patch.v4";
const V3_STORAGE_KEY = "egs.patch.v3";
const V2_STORAGE_KEY = "egs.patch.v2";
const LEGACY_STORAGE_KEY = "egs.patch.v1";

export function createBlock(index: number): SequencerBlock {
  return {
    kind: DRUM_VOICE_DEFS[index]?.id ? "voice" : "modulator",
    voice: DRUM_VOICE_DEFS[index]?.id ?? "",
    branchVoices: ["kick", "snare"],
    steps: 16,
    pulses: 0,
    rot: 0,
    rhythmId: `block-${index + 1}-rhythm-1`,
    repeats: 1,
    series: [],
    div: 1,
    prob: 100,
    gate: 50,
    clk: ["G"],
    rst: "",
    mut: "",
    mute: false,
    modulations: [],
    shape: "ramp",
  };
}

export function createVoice(id: VoiceId): VoiceState {
  return {
    machine: SYNTH_VOICE_IDS.has(id) ? "custom" : ["kick", "snare", "ch", "oh"].includes(id) ? "909" : "808",
    level: 78,
    tune: 0,
    decay: 50,
    mute: false,
    modulations: [],
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
  { v: "bassline", st: 16, pu: 7, ro: 1, dv: 1, pr: 100 },
  { v: "lead", st: 16, pu: 6, ro: 1, dv: 1, pr: 100 },
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
    if ("mod" in demo) block.modulations = [{ source: demo.mod.src, destination: demo.mod.dst, amount: demo.mod.amt }];
    return block;
  });
  const voices = createVoices();
  voices.bassline.modulations = [{ source: "12", destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: "13", destination: "vOct", amount: 1 }];
  voices.bassline.level = 72;
  voices.lead.level = 42;
  const effects = createEffects();
  effects.reverb = { ...effects.reverb, enabled: true, return: 95 };
  effects.sends.lead.reverb = 78;
  return { format: PATCH_FORMAT, bpm: 124, rate: 4, swing: 12, vol: volume, blocks, voices, effects };
}

export function createEmptyPatch(volume = 72): Patch {
  return {
    format: PATCH_FORMAT,
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
    const merged = { ...fallback, ...source, clk: Array.isArray(source.clk) ? [...source.clk] : [...fallback.clk] };
    const raw = source as Partial<SequencerBlock>;
    const voice = VOICE_DEFS.some(({ id }) => id === raw.voice) ? raw.voice as VoiceId : "";
    const legacyKind: BlockKind = voice ? "voice" : "modulator";
    merged.kind = ["voice", "modulator", "bernoulli"].includes(String(raw.kind)) ? raw.kind as BlockKind : legacyKind;
    merged.voice = merged.kind === "voice" ? voice || fallback.voice || "kick" : "";
    const branches = Array.isArray(raw.branchVoices) ? raw.branchVoices : fallback.branchVoices;
    const first = VOICE_DEFS.some(({ id }) => id === branches[0]) ? branches[0] as VoiceId : "kick";
    const secondCandidate = VOICE_DEFS.some(({ id }) => id === branches[1]) ? branches[1] as VoiceId : "snare";
    merged.branchVoices = [first, secondCandidate === first ? (first === "snare" ? "kick" : "snare") : secondCandidate];
    merged.steps = clamp(Math.round(Number(source.steps) || fallback.steps), 1, 32);
    merged.pulses = clamp(Math.round(Number(source.pulses) || 0), 0, merged.steps);
    merged.rot = clamp(Math.round(Number(source.rot) || 0), 0, merged.steps - 1);
    merged.repeats = clamp(Math.round(Number(raw.repeats) || 1), 1, 16);
    merged.rhythmId = typeof raw.rhythmId === "string" && raw.rhythmId ? raw.rhythmId : fallback.rhythmId;
    const rhythmIds = new Set([merged.rhythmId]);
    merged.series = (Array.isArray(raw.series) ? raw.series : []).slice(0, MAX_RHYTHMS - 1).map((rhythm, rhythmIndex) => {
      const fallbackId = `block-${index + 1}-rhythm-${rhythmIndex + 2}`;
      const normalized = normalizeRhythmPattern(rhythm, {
        id: fallbackId,
        steps: merged.steps,
        pulses: merged.pulses,
        rot: merged.rot,
        repeats: 1,
      });
      if (rhythmIds.has(normalized.id)) normalized.id = fallbackId;
      rhythmIds.add(normalized.id);
      return normalized;
    });
    merged.modulations = normalizeModulations(source, index);
    // Legacy fields must not survive reserialization or variation comparisons.
    const clean = merged as SequencerBlock & { modSrc?: unknown; modDst?: unknown; modAmt?: unknown };
    delete clean.modSrc;
    delete clean.modDst;
    delete clean.modAmt;
    return clean;
  });
  if (input.voices) {
    for (const { id } of VOICE_DEFS) {
      const source = input.voices[id];
      if (!source) continue;
      base.voices[id] = {
        ...base.voices[id],
        ...source,
        machine: SYNTH_VOICE_IDS.has(id) ? "custom" : ["808", "909", "custom"].includes(source.machine) ? source.machine : base.voices[id].machine,
        modulations: normalizeVoiceModulations(source.modulations, id),
        custom: normalizeCustomVoiceSettings(id, source.custom),
      };
    }
  }
  base.effects = normalizeEffects(input.effects);
  return base;
}

export function loadStoredPatch(): Patch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(V17_STORAGE_KEY) ?? localStorage.getItem(V16_STORAGE_KEY) ?? localStorage.getItem(V15_STORAGE_KEY) ?? localStorage.getItem(V14_STORAGE_KEY) ?? localStorage.getItem(V13_STORAGE_KEY) ?? localStorage.getItem(V12_STORAGE_KEY) ?? localStorage.getItem(V11_STORAGE_KEY) ?? localStorage.getItem(V10_STORAGE_KEY) ?? localStorage.getItem(V9_STORAGE_KEY) ?? localStorage.getItem(V8_STORAGE_KEY) ?? localStorage.getItem(V7_STORAGE_KEY) ?? localStorage.getItem(V6_STORAGE_KEY) ?? localStorage.getItem(V5_STORAGE_KEY) ?? localStorage.getItem(V4_STORAGE_KEY) ?? localStorage.getItem(V3_STORAGE_KEY) ?? localStorage.getItem(V2_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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
