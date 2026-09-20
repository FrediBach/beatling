import { VOICE_DEFS } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import type { EffectId, EffectsState, VoiceEffectSends, VoiceId } from "@/lib/types";

export const EFFECT_IDS: EffectId[] = ["distortion", "reverb", "delay", "compressor"];

const createSends = (): Record<VoiceId, VoiceEffectSends> => Object.fromEntries(
  VOICE_DEFS.map(({ id }) => [id, Object.fromEntries(EFFECT_IDS.map((effect) => [effect, 0]))]),
) as Record<VoiceId, VoiceEffectSends>;

export function createEffects(): EffectsState {
  return {
    distortion: { enabled: false, drive: 35, tone: 8000, return: 60 },
    reverb: { enabled: false, damping: 7000, return: 45 },
    delay: { enabled: false, time: 250, feedback: 30, tone: 6000, return: 45 },
    compressor: { enabled: false, threshold: -24, ratio: 6, attack: 10, release: 250, return: 55 },
    sends: createSends(),
  };
}

const number = (value: unknown, fallback: number, min: number, max: number) =>
  clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max);

export function normalizeEffects(value: unknown): EffectsState {
  const defaults = createEffects();
  if (!value || typeof value !== "object") return defaults;
  const input = value as Partial<EffectsState>;
  const distortion = input.distortion;
  const reverb = input.reverb;
  const delay = input.delay;
  const compressor = input.compressor;
  const effects: EffectsState = {
    distortion: {
      enabled: Boolean(distortion?.enabled),
      drive: number(distortion?.drive, defaults.distortion.drive, 0, 100),
      tone: number(distortion?.tone, defaults.distortion.tone, 400, 16000),
      return: number(distortion?.return, defaults.distortion.return, 0, 100),
    },
    reverb: {
      enabled: Boolean(reverb?.enabled),
      damping: number(reverb?.damping, defaults.reverb.damping, 1000, 16000),
      return: number(reverb?.return, defaults.reverb.return, 0, 100),
    },
    delay: {
      enabled: Boolean(delay?.enabled),
      time: number(delay?.time, defaults.delay.time, 40, 750),
      feedback: number(delay?.feedback, defaults.delay.feedback, 0, 85),
      tone: number(delay?.tone, defaults.delay.tone, 500, 12000),
      return: number(delay?.return, defaults.delay.return, 0, 100),
    },
    compressor: {
      enabled: Boolean(compressor?.enabled),
      threshold: number(compressor?.threshold, defaults.compressor.threshold, -60, 0),
      ratio: number(compressor?.ratio, defaults.compressor.ratio, 1, 20),
      attack: number(compressor?.attack, defaults.compressor.attack, 0, 100),
      release: number(compressor?.release, defaults.compressor.release, 50, 1000),
      return: number(compressor?.return, defaults.compressor.return, 0, 100),
    },
    sends: createSends(),
  };
  for (const { id } of VOICE_DEFS) {
    const sends = input.sends?.[id];
    for (const effect of EFFECT_IDS) {
      effects.sends[id][effect] = number(sends?.[effect], 0, 0, 100);
    }
  }
  return effects;
}

export function effectsHaveChanges(value: EffectsState, base: EffectsState): boolean {
  return JSON.stringify(value) !== JSON.stringify(base);
}

export const effectGain = (value: number) => (clamp(value, 0, 100) / 100) ** 2;
