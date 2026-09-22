import { normalizePatch } from "@/lib/patch";
import { ARRANGEMENT_FORMAT, type Arrangement, type Patch, type SequencerBlock, type SongPart, type Variation, type VoiceId, type VoiceState } from "@/lib/types";
import { effectsHaveChanges } from "@/lib/effects";

const STORAGE_KEY = "egs.arrangement.v24";
const V23_STORAGE_KEY = "egs.arrangement.v23";
const V22_STORAGE_KEY = "egs.arrangement.v22";
const V21_STORAGE_KEY = "egs.arrangement.v21";
const V20_STORAGE_KEY = "egs.arrangement.v20";
const V19_STORAGE_KEY = "egs.arrangement.v19";
const V18_STORAGE_KEY = "egs.arrangement.v18";
const V17_STORAGE_KEY = "egs.arrangement.v17";
const V16_STORAGE_KEY = "egs.arrangement.v16";
const V15_STORAGE_KEY = "egs.arrangement.v15";
const V14_STORAGE_KEY = "egs.arrangement.v14";
const V13_STORAGE_KEY = "egs.arrangement.v13";
const V12_STORAGE_KEY = "egs.arrangement.v12";
const V11_STORAGE_KEY = "egs.arrangement.v11";
const V10_STORAGE_KEY = "egs.arrangement.v10";
const V9_STORAGE_KEY = "egs.arrangement.v9";
const V8_STORAGE_KEY = "egs.arrangement.v8";
const V7_STORAGE_KEY = "egs.arrangement.v7";
const V6_STORAGE_KEY = "egs.arrangement.v6";
const V5_STORAGE_KEY = "egs.arrangement.v5";
const V4_STORAGE_KEY = "egs.arrangement.v4";
const V3_STORAGE_KEY = "egs.arrangement.v3";
const V2_STORAGE_KEY = "egs.arrangement.v2";
const LEGACY_STORAGE_KEY = "egs.arrangement.v1";
export const MAX_VARIATIONS = 8;

export function createArrangement(patch: Patch): Arrangement {
  return {
    format: ARRANGEMENT_FORMAT,
    variations: [{ id: "variation-1", name: "A", patch }],
    songParts: [{ id: "song-part-1", variationId: "variation-1", bars: 1 }],
    activeIndex: 0,
    activeSongPartIndex: 0,
    songMode: false,
  };
}

export function normalizeArrangement(value: unknown, fallback: Patch): Arrangement {
  if (!value || typeof value !== "object") return createArrangement(fallback);
  const input = value as Partial<Arrangement>;
  if (!Array.isArray(input.variations) || input.variations.length === 0) return createArrangement(fallback);
  const variations = input.variations.slice(0, MAX_VARIATIONS).flatMap((source, index) => {
    const patch = normalizePatch(source?.patch);
    if (!patch) return [];
    return [{
      id: typeof source.id === "string" && source.id ? source.id : `variation-${index + 1}`,
      name: String.fromCharCode(65 + index),
      patch,
    }];
  });
  if (variations.length === 0) return createArrangement(fallback);
  const variationIds = new Set(variations.map(({ id }) => id));
  const rawSongParts = Array.isArray(input.songParts) ? input.songParts : [];
  const songParts = rawSongParts.flatMap((source, index) => {
    if (!source || typeof source !== "object") return [];
    const candidate = source as Partial<SongPart>;
    if (typeof candidate.variationId !== "string" || !variationIds.has(candidate.variationId)) return [];
    return [{
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : `song-part-${index + 1}`,
      variationId: candidate.variationId,
      bars: Math.min(16, Math.max(1, Math.round(Number(candidate.bars) || 1))),
    }];
  });
  // Older saved arrangements stored length directly on each variation. Turn
  // those entries into independent song parts so existing songs keep playing.
  const migratedSongParts = songParts.length > 0 ? songParts : variations.map((variation, index) => ({
    id: `song-part-${index + 1}`,
    variationId: variation.id,
    bars: Math.min(16, Math.max(1, Math.round(Number((input.variations?.[index] as { repeats?: number } | undefined)?.repeats) || 1))),
  }));
  return {
    format: ARRANGEMENT_FORMAT,
    variations,
    songParts: migratedSongParts,
    activeIndex: Math.min(variations.length - 1, Math.max(0, Math.round(Number(input.activeIndex) || 0))),
    activeSongPartIndex: Math.min(migratedSongParts.length - 1, Math.max(0, Math.round(Number(input.activeSongPartIndex) || 0))),
    songMode: Boolean(input.songMode),
  };
}

export function loadStoredArrangement(fallback: Patch): Arrangement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(V23_STORAGE_KEY) ?? localStorage.getItem(V22_STORAGE_KEY) ?? localStorage.getItem(V21_STORAGE_KEY) ?? localStorage.getItem(V20_STORAGE_KEY) ?? localStorage.getItem(V19_STORAGE_KEY) ?? localStorage.getItem(V18_STORAGE_KEY) ?? localStorage.getItem(V17_STORAGE_KEY) ?? localStorage.getItem(V16_STORAGE_KEY) ?? localStorage.getItem(V15_STORAGE_KEY) ?? localStorage.getItem(V14_STORAGE_KEY) ?? localStorage.getItem(V13_STORAGE_KEY) ?? localStorage.getItem(V12_STORAGE_KEY) ?? localStorage.getItem(V11_STORAGE_KEY) ?? localStorage.getItem(V10_STORAGE_KEY) ?? localStorage.getItem(V9_STORAGE_KEY) ?? localStorage.getItem(V8_STORAGE_KEY) ?? localStorage.getItem(V7_STORAGE_KEY) ?? localStorage.getItem(V6_STORAGE_KEY) ?? localStorage.getItem(V5_STORAGE_KEY) ?? localStorage.getItem(V4_STORAGE_KEY) ?? localStorage.getItem(V3_STORAGE_KEY) ?? localStorage.getItem(V2_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizeArrangement(JSON.parse(raw), fallback) : createArrangement(fallback);
  } catch {
    return createArrangement(fallback);
  }
}

export function saveArrangement(arrangement: Arrangement): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arrangement));
  } catch {
    // The arranger remains usable if browser storage is unavailable.
  }
}

export function changedBlockFields(block: SequencerBlock, base: SequencerBlock): Set<keyof SequencerBlock> {
  return new Set((Object.keys(block) as Array<keyof SequencerBlock>).filter((key) => {
    if (key === "modulations" || key === "branchVoices" || key === "series") return JSON.stringify(block[key]) !== JSON.stringify(base[key]);
    if (key === "clk") return block.clk.join(",") !== base.clk.join(",");
    return block[key] !== base[key];
  }));
}

export function changedVoiceFields(voice: VoiceState, base: VoiceState): Set<keyof VoiceState> {
  return new Set((Object.keys(voice) as Array<keyof VoiceState>).filter((key) => {
    if (key === "custom" || key === "modulations") return JSON.stringify(voice[key]) !== JSON.stringify(base[key]);
    return voice[key] !== base[key];
  }));
}

export function variationHasChanges(variation: Variation, base: Variation): boolean {
  if (variation === base) return false;
  if (variation.patch.blocks.some((block, index) => changedBlockFields(block, base.patch.blocks[index]).size > 0)) return true;
  if ((Object.keys(variation.patch.voices) as VoiceId[]).some((id) => changedVoiceFields(variation.patch.voices[id], base.patch.voices[id]).size > 0)) return true;
  return effectsHaveChanges(variation.patch.effects, base.patch.effects);
}
