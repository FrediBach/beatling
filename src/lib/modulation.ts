import { MOD_DESTS } from "./constants";
import { clamp } from "./euclid";
import { BLOCK_COUNT, type ModulationRoute, type SequencerBlock, type VoiceState, type EffectiveBlock } from "./types";

export const MODULATION_TARGETS = MOD_DESTS.filter((entry): entry is [ModulationRoute["destination"], string] => entry[0] !== "");

export function normalizeModulations(value: object, index: number): ModulationRoute[] {
  const input = value as { modulations?: unknown; modSrc?: unknown; modDst?: unknown; modAmt?: unknown };
  const routes = Array.isArray(input.modulations) ? input.modulations : [{ source: input.modSrc, destination: input.modDst, amount: input.modAmt }];
  const seen = new Set<string>();
  return routes.slice(0, 32).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const route = entry as ModulationRoute;
    if (!MODULATION_TARGETS.some(([destination]) => destination === route.destination) || seen.has(route.destination)) return [];
    const source = String(route.source);
    if (source !== "" && (!/^\d+$/.test(source) || Number(source) >= BLOCK_COUNT || Number(source) === index)) return [];
    seen.add(route.destination);
    return [{ source: source === "" ? "" : String(Number(source)) as ModulationRoute["source"], destination: route.destination, amount: Number.isFinite(route.amount) ? clamp(route.amount, -1, 1) : 0 }];
  });
}

export const signedAmount = (amount: number) => `${amount > 0 ? "+" : ""}${Math.round(amount * 100)}%`;

export function targetValue(destination: ModulationRoute["destination"], block: SequencerBlock, voice?: VoiceState, effective?: EffectiveBlock): string {
  if (destination === "tune") return voice ? `${Math.round(clamp(voice.tune + (effective?.tune ?? 0) * 12, -24, 24))} st` : "No voice";
  if (destination === "decay") return voice ? `${Math.round(clamp(0.25 + (voice.decay + (effective?.decay ?? 0) * 50) / 100 * 1.6, 0.15, 2.4) * 100)}% time` : "No voice";
  if (destination === "level") return voice ? `${Math.round(clamp(voice.level / 100 * (1 + (effective?.level ?? 0) * 0.6), 0, 1.4) * 100)}%` : "No voice";
  return `${Math.round(effective?.[destination] ?? block[destination])}${destination === "prob" ? "%" : ""}`;
}
