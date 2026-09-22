import type { CustomVoiceSettings, VoiceId } from "@/lib/types";
import { NOTE_NAMES, SCALE_DEFS } from "@/lib/quantizer";

export interface VoiceParameterDefinition {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description: string;
  options?: Array<{ value: number; label: string }>;
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
const pitch = (...parameters: VoiceParameterDefinition[]): VoiceParameterSection => ({ title: "Pitch quantizer", parameters });
const optionParameter = (key: string, label: string, options: string[], description: string): VoiceParameterDefinition => ({ key, label, min: 0, max: options.length - 1, step: 1, description, options: options.map((name, value) => ({ value, label: name })) });
const brightness = () => parameter("lowpass", "Brightness", 1500, 20000, 100, "Low-pass cutoff for metal and noise together; 20000 bypasses it.", "Hz");
const balance = () => parameter("balance", "Partial balance", 0, 100, 1, "Blend from the low partial to the high partial; 50 keeps both equal.", "%");
const quantizerParameters = () => pitch(
  optionParameter("root", "Root note", [...NOTE_NAMES], "Tonic used by the quantized V/Oct input."),
  optionParameter("scale", "Scale", SCALE_DEFS.map(({ name }) => name), "Allowed notes for incoming control voltage."),
  parameter("octave", "Base octave", 1, 6, 1, "Octave played at zero volts."),
);

export const VOICE_PARAMETER_SECTIONS: Record<VoiceId, VoiceParameterSection[]> = {
  kick: [
    tone(
      parameter("bodyTone", "Body harmonics", 0, 100, 1, "Blend the sine body toward triangle for more audible upper harmonics.", "%"),
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
    envelope(
      parameter("toneDecay", "Body length", 30, 600, 5, "Shell decay, independent of the snare wires; scaled by Decay.", "ms"),
      parameter("noiseDecay", "Noise length", 40, 900, 5, "Base noise decay before the main Decay control is applied.", "ms"),
    ),
  ],
  clap: [
    transient(
      parameter("burstCount", "Burst count", 1, 6, 1, "Number of short impulses in the initial clap.", "hits"),
      parameter("burstDecay", "Burst length", 5, 60, 1, "Length of each impulse: short cracks or overlapping handclaps.", "ms"),
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
      balance(),
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
      brightness(),
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
      brightness(),
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
      balance(),
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
      brightness(),
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
  bassline: [
    quantizerParameters(),
    tone(
      optionParameter("waveform", "Oscillator", ["Saw", "Square"], "Core oscillator shape."),
      parameter("cutoff", "Filter cutoff", 80, 8000, 10, "Resting cutoff of the resonant low-pass filter.", "Hz"),
      parameter("resonance", "Resonance", 0.1, 18, 0.1, "Emphasis around the filter cutoff.", "Q"),
      parameter("envelopeAmount", "Envelope amount", 0, 100, 1, "How far the filter opens on each note.", "%"),
    ),
    envelope(
      parameter("ampDecay", "Amplitude length", 0, 2400, 10, "Independent note decay; 0 follows Filter decay. Scaled by Decay.", "ms"),
      parameter("filterDecay", "Filter decay", 30, 1200, 5, "Time for the filter to return to its cutoff.", "ms"),
      parameter("accent", "Accent", 0, 100, 1, "Extra bite and level on each triggered note.", "%"),
    ),
  ],
  lead: [
    quantizerParameters(),
    tone(
      optionParameter("waveform", "Main oscillator", ["Saw", "Square", "Triangle"], "Primary oscillator shape."),
      parameter("subLevel", "Sub oscillator", 0, 100, 1, "Sine one octave below the main oscillator, through the same filter.", "%"),
      parameter("pulseMix", "Companion mix", 0, 100, 1, "Level of a detuned square companion oscillator.", "%"),
      parameter("detune", "Companion detune", -30, 30, 1, "Detuning of the companion oscillator.", "ct"),
      parameter("cutoff", "Filter cutoff", 200, 12000, 25, "Resting cutoff of the low-pass filter.", "Hz"),
      parameter("resonance", "Resonance", 0.1, 14, 0.1, "Emphasis around the filter cutoff.", "Q"),
      parameter("envelopeAmount", "Envelope amount", 0, 100, 1, "How far the filter opens on each note.", "%"),
    ),
    envelope(
      parameter("filterDecay", "Filter decay", 0, 2400, 10, "Independent filter sweep; 0 follows Release. Scaled by Decay.", "ms"),
      parameter("attack", "Attack", 1, 500, 1, "Time to reach full level.", "ms"),
      parameter("release", "Release", 30, 2400, 10, "Base note release before the main Decay control.", "ms"),
    ),
  ],
};

const tomSections = (name: string): VoiceParameterSection[] => [
  tone(
    parameter("bodyFrequency", `${name} pitch`, 45, 320, 1, "Fundamental pitch of the tom body.", "Hz"),
    parameter("pitchAmount", "Pitch sweep", 1, 4, 0.05, "Starting pitch as a multiple of the body pitch.", "×"),
    parameter("pitchDecay", "Pitch decay", 10, 300, 1, "Time for the pitch to fall to the body frequency.", "ms"),
    parameter("overtoneLevel", "Overtone", 0, 100, 1, "Short shell mode at 1.5 times the body pitch; adds a woody knock.", "%"),
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
  kick: { bodyTone: 0, bodyFrequency: 50, pitchAmount: 5.5, pitchDecay: 55, clickLevel: 32, clickFrequency: 1800, clickDecay: 16, bodyDecay: 620 },
  snare: { toneDecay: 130, toneFrequency: 185, toneSpread: 1.62, toneLevel: 42, noiseLevel: 80, noiseFilter: 1800, noiseQ: 0.9, noiseDecay: 260 },
  clap: { burstDecay: 18, burstCount: 3, burstSpacing: 11, burstLevel: 55, filterFrequency: 1080, filterQ: 1.1, tailLevel: 50, tailDecay: 220 },
  rim: { balance: 50, lowFrequency: 1670, highFrequency: 2350, filterFrequency: 1750, filterQ: 3.5, toneLevel: 70, noiseLevel: 25, duration: 35 },
  ch: { lowpass: 20000, metalLevel: 50, metalBase: 40, highpass: 7400, noiseLevel: 18, noiseHighpass: 7800, duration: 58 },
  oh: { lowpass: 20000, metalLevel: 48, metalBase: 40, highpass: 7000, noiseLevel: 30, noiseHighpass: 7600, duration: 420 },
  lt: { overtoneLevel: 0, bodyFrequency: 92, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 368, duration: 450 },
  mt: { overtoneLevel: 0, bodyFrequency: 138, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 552, duration: 450 },
  ht: { overtoneLevel: 0, bodyFrequency: 196, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 784, duration: 450 },
  cow: { balance: 50, lowFrequency: 540, highFrequency: 800, filterFrequency: 2640, filterQ: 1.4, toneLevel: 55, duration: 360 },
  cym: { lowpass: 20000, metalBase: 40, metalLevel: 40, highpass: 4200, noiseLevel: 32, noiseHighpass: 5200, duration: 1400 },
  shk: { noiseLevel: 50, filterFrequency: 6200, filterQ: 1.6, attack: 6, duration: 75 },
  bassline: { ampDecay: 0, root: 0, scale: 2, octave: 2, waveform: 0, cutoff: 700, resonance: 12, envelopeAmount: 82, filterDecay: 260, accent: 30 },
  lead: { filterDecay: 0, subLevel: 0, root: 0, scale: 1, octave: 4, waveform: 0, pulseMix: 28, detune: 7, cutoff: 3200, resonance: 3.5, envelopeAmount: 38, attack: 8, release: 520 },
};

export function createCustomVoiceSettings(id: VoiceId): CustomVoiceSettings {
  return { ...DEFAULT_CUSTOM_VOICE_SETTINGS[id] };
}

export function normalizeCustomVoiceSettings(id: VoiceId, value: unknown): CustomVoiceSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(VOICE_PARAMETER_SECTIONS[id].flatMap((section) => section.parameters).map((definition) => {
    const raw = source[definition.key];
    const candidate = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "") ? Number(raw) : NaN;
    const fallback = DEFAULT_CUSTOM_VOICE_SETTINGS[id][definition.key];
    const finite = Number.isFinite(candidate) ? candidate : fallback;
    const clamped = Math.min(definition.max, Math.max(definition.min, finite));
    const stepped = Math.round(clamped / definition.step) * definition.step;
    return [definition.key, Number(stepped.toFixed(4))];
  }));
}
