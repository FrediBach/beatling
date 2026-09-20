import type { CustomVoiceSettings, VoiceId } from "@/lib/types";

export interface VoiceParameterDefinition {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description: string;
}

export interface VoiceParameterSection {
  title: string;
  parameters: VoiceParameterDefinition[];
}

const parameter = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  description: string,
  unit?: string,
): VoiceParameterDefinition => ({ key, label, min, max, step, description, unit });

const tone = (...parameters: VoiceParameterDefinition[]): VoiceParameterSection => ({ title: "Tone", parameters });
const transient = (...parameters: VoiceParameterDefinition[]): VoiceParameterSection => ({ title: "Transient", parameters });
const noise = (...parameters: VoiceParameterDefinition[]): VoiceParameterSection => ({ title: "Noise", parameters });
const envelope = (...parameters: VoiceParameterDefinition[]): VoiceParameterSection => ({ title: "Envelope", parameters });

export const VOICE_PARAMETER_SECTIONS: Record<VoiceId, VoiceParameterSection[]> = {
  kick: [
    tone(
      parameter("bodyFrequency", "Body frequency", 30, 100, 1, "Fundamental pitch of the drum body.", "Hz"),
      parameter("pitchAmount", "Pitch sweep", 1, 12, 0.1, "Starting pitch as a multiple of the body pitch.", "×"),
      parameter("pitchDecay", "Pitch decay", 5, 200, 1, "Time for the pitch to fall to the body frequency.", "ms"),
    ),
    transient(
      parameter("clickLevel", "Click level", 0, 100, 1, "Amount of filtered noise at the start.", "%"),
      parameter("clickFrequency", "Click filter", 400, 8000, 50, "High-pass cutoff for the attack click.", "Hz"),
      parameter("clickDecay", "Click decay", 3, 80, 1, "Length of the attack click.", "ms"),
    ),
    envelope(parameter("bodyDecay", "Body length", 80, 1800, 10, "Base amplitude decay before the main Decay control is applied.", "ms")),
  ],
  snare: [
    tone(
      parameter("toneFrequency", "Tone frequency", 80, 400, 1, "Fundamental pitch of the lower shell mode.", "Hz"),
      parameter("toneSpread", "Tone spread", 1.1, 2.4, 0.01, "Ratio between the two shell oscillators.", "×"),
      parameter("toneLevel", "Tone level", 0, 100, 1, "Level of the pitched shell oscillators.", "%"),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the snare noise layer.", "%"),
      parameter("noiseFilter", "Noise filter", 300, 7000, 50, "Center or cutoff frequency of the noise layer.", "Hz"),
      parameter("noiseQ", "Filter resonance", 0.1, 8, 0.1, "Resonance of the noise filter.", "Q"),
    ),
    envelope(parameter("noiseDecay", "Noise length", 40, 900, 5, "Base noise decay before the main Decay control is applied.", "ms")),
  ],
  clap: [
    transient(
      parameter("burstCount", "Burst count", 1, 6, 1, "Number of short impulses in the initial clap.", "hits"),
      parameter("burstSpacing", "Burst spacing", 3, 30, 1, "Time between the initial impulses.", "ms"),
      parameter("burstLevel", "Burst level", 0, 100, 1, "Level of the initial impulses.", "%"),
    ),
    tone(
      parameter("filterFrequency", "Body filter", 300, 3500, 25, "Band-pass center frequency for the clap body.", "Hz"),
      parameter("filterQ", "Filter resonance", 0.2, 6, 0.1, "Resonance of the clap body filter.", "Q"),
    ),
    envelope(
      parameter("tailLevel", "Tail level", 0, 100, 1, "Level of the diffuse noise tail.", "%"),
      parameter("tailDecay", "Tail length", 40, 1000, 5, "Base tail decay before the main Decay control is applied.", "ms"),
    ),
  ],
  rim: [
    tone(
      parameter("lowFrequency", "Low partial", 500, 3500, 10, "Frequency of the lower square-wave partial.", "Hz"),
      parameter("highFrequency", "High partial", 800, 6000, 10, "Frequency of the upper square-wave partial.", "Hz"),
      parameter("filterFrequency", "Body filter", 500, 5000, 25, "Band-pass center frequency for both partials.", "Hz"),
      parameter("filterQ", "Filter resonance", 0.2, 12, 0.1, "Resonance of the rim body filter.", "Q"),
    ),
    transient(
      parameter("toneLevel", "Tone level", 0, 100, 1, "Level of the two pitched partials.", "%"),
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the short noise crack.", "%"),
      parameter("duration", "Length", 10, 200, 1, "Base body length before the main Decay control is applied.", "ms"),
    ),
  ],
  ch: [
    tone(
      parameter("metalLevel", "Metal level", 0, 100, 1, "Level of the six inharmonic oscillators.", "%"),
      parameter("metalBase", "Metal base", 20, 120, 1, "Base frequency used by the metallic oscillator bank.", "Hz"),
      parameter("highpass", "High-pass", 2000, 14000, 50, "Removes low frequencies from the metallic layer.", "Hz"),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the broadband noise layer.", "%"),
      parameter("noiseHighpass", "Noise high-pass", 2000, 14000, 50, "High-pass cutoff for the noise layer.", "Hz"),
    ),
    envelope(parameter("duration", "Closed length", 15, 300, 1, "Base hat length before the main Decay control is applied.", "ms")),
  ],
  oh: [
    tone(
      parameter("metalLevel", "Metal level", 0, 100, 1, "Level of the six inharmonic oscillators.", "%"),
      parameter("metalBase", "Metal base", 20, 120, 1, "Base frequency used by the metallic oscillator bank.", "Hz"),
      parameter("highpass", "High-pass", 2000, 14000, 50, "Removes low frequencies from the metallic layer.", "Hz"),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the broadband noise layer.", "%"),
      parameter("noiseHighpass", "Noise high-pass", 2000, 14000, 50, "High-pass cutoff for the noise layer.", "Hz"),
    ),
    envelope(parameter("duration", "Open length", 80, 1800, 10, "Base hat length before the main Decay control is applied.", "ms")),
  ],
  lt: [],
  mt: [],
  ht: [],
  cow: [
    tone(
      parameter("lowFrequency", "Low oscillator", 150, 1200, 5, "Frequency of the lower square-wave oscillator.", "Hz"),
      parameter("highFrequency", "High oscillator", 250, 1800, 5, "Frequency of the upper square-wave oscillator.", "Hz"),
      parameter("filterFrequency", "Body filter", 500, 6000, 25, "Band-pass center frequency for the cowbell body.", "Hz"),
      parameter("filterQ", "Filter resonance", 0.2, 8, 0.1, "Resonance of the cowbell body filter.", "Q"),
      parameter("toneLevel", "Tone level", 0, 100, 1, "Output level of the oscillator pair.", "%"),
    ),
    envelope(parameter("duration", "Length", 40, 1200, 5, "Base length before the main Decay control is applied.", "ms")),
  ],
  cym: [
    tone(
      parameter("metalBase", "Metal base", 20, 120, 1, "Base frequency used by the metallic oscillator bank.", "Hz"),
      parameter("metalLevel", "Metal level", 0, 100, 1, "Level of the inharmonic oscillator bank.", "%"),
      parameter("highpass", "Metal high-pass", 1000, 10000, 50, "High-pass cutoff for the metallic layer.", "Hz"),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the broadband noise wash.", "%"),
      parameter("noiseHighpass", "Noise high-pass", 1000, 12000, 50, "High-pass cutoff for the noise wash.", "Hz"),
    ),
    envelope(parameter("duration", "Length", 100, 4000, 10, "Base cymbal length before the main Decay control is applied.", "ms")),
  ],
  shk: [
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Output level of the shaker noise.", "%"),
      parameter("filterFrequency", "Body filter", 1000, 12000, 50, "Band-pass center frequency of the shaker.", "Hz"),
      parameter("filterQ", "Filter resonance", 0.2, 8, 0.1, "Resonance of the shaker body filter.", "Q"),
    ),
    envelope(
      parameter("attack", "Attack", 1, 40, 1, "Time for the shaker to reach its peak.", "ms"),
      parameter("duration", "Length", 15, 600, 1, "Base length before the main Decay control is applied.", "ms"),
    ),
  ],
};

const tomSections = (name: string): VoiceParameterSection[] => [
  tone(
    parameter("bodyFrequency", `${name} pitch`, 45, 320, 1, "Fundamental pitch of the tom body.", "Hz"),
    parameter("pitchAmount", "Pitch sweep", 1, 4, 0.05, "Starting pitch as a multiple of the body pitch.", "×"),
    parameter("pitchDecay", "Pitch decay", 10, 300, 1, "Time for the pitch to fall to the body frequency.", "ms"),
    parameter("bodyLevel", "Body level", 0, 100, 1, "Level of the sine-wave drum body.", "%"),
  ),
  noise(
    parameter("noiseLevel", "Attack noise", 0, 100, 1, "Level of the short stick transient.", "%"),
    parameter("noiseFilter", "Noise filter", 150, 5000, 25, "Band-pass center frequency for the transient.", "Hz"),
  ),
  envelope(parameter("duration", "Length", 50, 1500, 5, "Base length before the main Decay control is applied.", "ms")),
];

VOICE_PARAMETER_SECTIONS.lt = tomSections("Low tom");
VOICE_PARAMETER_SECTIONS.mt = tomSections("Mid tom");
VOICE_PARAMETER_SECTIONS.ht = tomSections("High tom");

export const DEFAULT_CUSTOM_VOICE_SETTINGS: Record<VoiceId, CustomVoiceSettings> = {
  kick: { bodyFrequency: 50, pitchAmount: 5.5, pitchDecay: 55, clickLevel: 32, clickFrequency: 1800, clickDecay: 16, bodyDecay: 620 },
  snare: { toneFrequency: 185, toneSpread: 1.62, toneLevel: 42, noiseLevel: 80, noiseFilter: 1800, noiseQ: 0.9, noiseDecay: 260 },
  clap: { burstCount: 3, burstSpacing: 11, burstLevel: 55, filterFrequency: 1080, filterQ: 1.1, tailLevel: 50, tailDecay: 220 },
  rim: { lowFrequency: 1670, highFrequency: 2350, filterFrequency: 1750, filterQ: 3.5, toneLevel: 70, noiseLevel: 25, duration: 35 },
  ch: { metalLevel: 50, metalBase: 40, highpass: 7400, noiseLevel: 18, noiseHighpass: 7800, duration: 58 },
  oh: { metalLevel: 48, metalBase: 40, highpass: 7000, noiseLevel: 30, noiseHighpass: 7600, duration: 420 },
  lt: { bodyFrequency: 92, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 368, duration: 450 },
  mt: { bodyFrequency: 138, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 552, duration: 450 },
  ht: { bodyFrequency: 196, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 784, duration: 450 },
  cow: { lowFrequency: 540, highFrequency: 800, filterFrequency: 2640, filterQ: 1.4, toneLevel: 55, duration: 360 },
  cym: { metalBase: 40, metalLevel: 40, highpass: 4200, noiseLevel: 32, noiseHighpass: 5200, duration: 1400 },
  shk: { noiseLevel: 50, filterFrequency: 6200, filterQ: 1.6, attack: 6, duration: 75 },
};

export function createCustomVoiceSettings(id: VoiceId): CustomVoiceSettings {
  return { ...DEFAULT_CUSTOM_VOICE_SETTINGS[id] };
}

export function normalizeCustomVoiceSettings(id: VoiceId, value: unknown): CustomVoiceSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(VOICE_PARAMETER_SECTIONS[id].flatMap((section) => section.parameters).map((definition) => {
    const candidate = Number(source[definition.key]);
    const fallback = DEFAULT_CUSTOM_VOICE_SETTINGS[id][definition.key];
    const finite = Number.isFinite(candidate) ? candidate : fallback;
    const clamped = Math.min(definition.max, Math.max(definition.min, finite));
    const stepped = Math.round(clamped / definition.step) * definition.step;
    return [definition.key, Number(stepped.toFixed(4))];
  }));
}
