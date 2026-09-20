import { normalizePatch } from "@/lib/patch";
import type { Arrangement, Patch, SequencerBlock, Variation, VoiceId, VoiceState } from "@/lib/types";

const STORAGE_KEY = "egs.arrangement.v1";
export const MAX_VARIATIONS = 8;

export function createArrangement(patch: Patch): Arrangement {
  return {
    format: "euclid-grid.arrangement.v1",
    variations: [{ id: "variation-1", name: "A", repeats: 1, patch }],
    activeIndex: 0,
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
      repeats: Math.min(16, Math.max(1, Math.round(Number(source.repeats) || 1))),
      patch,
    }];
  });
  if (variations.length === 0) return createArrangement(fallback);
  return {
    format: "euclid-grid.arrangement.v1",
    variations,
    activeIndex: Math.min(variations.length - 1, Math.max(0, Math.round(Number(input.activeIndex) || 0))),
    songMode: Boolean(input.songMode),
  };
}

export function loadStoredArrangement(fallback: Patch): Arrangement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    if (key === "clk") return block.clk.join(",") !== base.clk.join(",");
    return block[key] !== base[key];
  }));
}

export function changedVoiceFields(voice: VoiceState, base: VoiceState): Set<keyof VoiceState> {
  return new Set((Object.keys(voice) as Array<keyof VoiceState>).filter((key) => voice[key] !== base[key]));
}

export function variationHasChanges(variation: Variation, base: Variation): boolean {
  if (variation === base) return false;
  if (variation.patch.blocks.some((block, index) => changedBlockFields(block, base.patch.blocks[index]).size > 0)) return true;
  return (Object.keys(variation.patch.voices) as VoiceId[]).some((id) => changedVoiceFields(variation.patch.voices[id], base.patch.voices[id]).size > 0);
}
