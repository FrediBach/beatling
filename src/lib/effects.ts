import { VOICE_DEFS } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import type { DelayDivision, DelaySettings, DistortionSettings, EffectId, EffectsState, ReverbSpace, VoiceEffectSends, VoiceId } from "@/lib/types";

export const EFFECT_IDS: EffectId[] = ["distortion", "reverb", "delay", "karplus", "compressor"];

const createSends = (): Record<VoiceId, VoiceEffectSends> => Object.fromEntries(
  VOICE_DEFS.map(({ id }) => [id, Object.fromEntries(EFFECT_IDS.map((effect) => [effect, 0]))]),
) as Record<VoiceId, VoiceEffectSends>;

export function createEffects(): EffectsState {
  return {
    distortion: { mode: "soft", trim: 0, enabled: false, drive: 35, tone: 8000, return: 60 },
    reverb: { space: "studio", preDelay: 0, lowCut: 0, enabled: false, damping: 7000, return: 45 },
    delay: { sync: false, division: "1/8", lowCut: 0, enabled: false, time: 250, feedback: 30, tone: 6000, return: 45 },
    karplus: { octave: 0, excitation: 16000, enabled: false, model: "string", tune: 48, body: 60, decay: 65, return: 50 },
    compressor: { knee: 30, makeup: 0, enabled: false, threshold: -24, ratio: 6, attack: 10, release: 250, return: 55 },
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
  const karplus = input.karplus;
  const compressor = input.compressor;
  const effects: EffectsState = {
    distortion: {
      mode: distortion?.mode === "hard" || distortion?.mode === "fold" ? distortion.mode : "soft",
      trim: number(distortion?.trim, 0, -24, 6),
      enabled: Boolean(distortion?.enabled),
      drive: number(distortion?.drive, defaults.distortion.drive, 0, 100),
      tone: number(distortion?.tone, defaults.distortion.tone, 400, 16000),
      return: number(distortion?.return, defaults.distortion.return, 0, 100),
    },
    reverb: {
      space: reverb?.space === "room" || reverb?.space === "hall" ? reverb.space : "studio",
      preDelay: number(reverb?.preDelay, 0, 0, 200),
      lowCut: number(reverb?.lowCut, 0, 0, 2000),
      enabled: Boolean(reverb?.enabled),
      damping: number(reverb?.damping, defaults.reverb.damping, 1000, 16000),
      return: number(reverb?.return, defaults.reverb.return, 0, 100),
    },
    delay: {
      sync: delay?.sync === true,
      division: DELAY_DIVISIONS.some(({ value }) => value === delay?.division) ? delay!.division : "1/8",
      lowCut: number(delay?.lowCut, 0, 0, 2000),
      enabled: Boolean(delay?.enabled),
      time: number(delay?.time, defaults.delay.time, 40, 2000),
      feedback: number(delay?.feedback, defaults.delay.feedback, 0, 85),
      tone: number(delay?.tone, defaults.delay.tone, 500, 12000),
      return: number(delay?.return, defaults.delay.return, 0, 100),
    },
    karplus: {
      octave: Math.round(number(karplus?.octave, 0, -2, 2)),
      excitation: number(karplus?.excitation, 16000, 200, 16000),
      enabled: Boolean(karplus?.enabled),
      model: karplus?.model === "tube" ? "tube" : "string",
      tune: number(karplus?.tune, defaults.karplus.tune, 0, 100),
      body: number(karplus?.body, defaults.karplus.body, 0, 100),
      decay: number(karplus?.decay, defaults.karplus.decay, 0, 100),
      return: number(karplus?.return, defaults.karplus.return, 0, 100),
    },
    compressor: {
      knee: number(compressor?.knee, 30, 0, 40),
      makeup: number(compressor?.makeup, 0, 0, 18),
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

/** Volca-style range: the bottom of the control becomes a tempo-like echo. */
export const waveguideFrequency = (tune: number) => 4 * 2 ** (clamp(tune, 0, 100) / 12);

export const waveguideDamping = (body: number) => 250 * 64 ** (clamp(body, 0, 100) / 100);

export const waveguideFeedback = (decay: number) => 0.35 + clamp(decay, 0, 100) / 100 * 0.645;

export const DELAY_DIVISIONS: { value: DelayDivision; label: string; beats: number }[] = [
  { value: "1/16", label: "1/16", beats: 0.25 }, { value: "1/8", label: "1/8", beats: 0.5 },
  { value: "1/8D", label: "1/8 dotted", beats: 0.75 }, { value: "1/8T", label: "1/8 triplet", beats: 1 / 3 },
  { value: "1/4", label: "1/4", beats: 1 }, { value: "1/2", label: "1/2", beats: 2 },
];
export const REVERB_SECONDS: Record<ReverbSpace, number> = { room: 0.6, studio: 1.8, hall: 3.6 };
export const delaySeconds = (delay: DelaySettings, bpm: number) => delay.sync
  ? Math.min(6, 60 / clamp(bpm, 20, 300) * (DELAY_DIVISIONS.find(({ value }) => value === delay.division)?.beats ?? 0.5))
  : delay.time / 1000;

/** Bounded, odd transfer functions avoid DC; shared by the processor and its preview. */
export function distortionSample(input: number, settings: Pick<DistortionSettings, "drive" | "mode">): number {
  const amount = 1 + settings.drive * 4;
  if (settings.mode === "hard") return clamp(input * (1 + settings.drive / 5), -1, 1);
  if (settings.mode === "fold") return 2 / Math.PI * Math.asin(Math.sin(input * (1 + settings.drive / 8) * Math.PI / 2));
  return Math.tanh(input * amount) / Math.tanh(amount);
}

/** Static compressor curve, including the soft-knee region, in dB. */
export function compressedDb(input: number, threshold: number, ratio: number, knee: number): number {
  const offset = input - threshold;
  if (offset < -knee / 2) return input;
  if (knee > 0 && offset < knee / 2) return input + (1 / ratio - 1) * (offset + knee / 2) ** 2 / (2 * knee);
  return threshold + offset / ratio;
}
