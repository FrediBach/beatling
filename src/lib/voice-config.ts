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
  allMachines?: boolean;
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
const brightness = () => parameter("lowpass", "Brightness", 1500, 20000, 100, "Low-pass cutoff for all voice layers together; 20000 bypasses it.", "Hz");
const metalFilter = () => [
  parameter("metalFocus", "Metal focus", 1000, 14000, 50, "Band-pass center for the metallic oscillators only. 9000 keeps the original focus. Lower the metal high-pass too when exploring lower bands.", "Hz"),
  parameter("metalQ", "Metal resonance", 0.1, 8, 0.1, "Width of the metallic band: lower values are broad, higher values emphasize a narrower band. 0.9 keeps the original response.", "Q"),
];
const balance = () => parameter("balance", "Partial balance", 0, 100, 1, "Blend from the low partial to the high partial; 50 keeps both equal.", "%");
const filterTracking = () => parameter("filterTracking", "Filter tracking", 0, 100, 1, "Raise or lower the filter with note pitch and Glide. At 100%, each octave doubles the cutoff; C3 is the reference. 0 keeps a fixed cutoff.", "%");
const synthArticulation = (): VoiceParameterSection => ({
  title: "Articulation",
  parameters: [
    optionParameter("playMode", "Playback", ["Polyphonic", "Mono retrigger"], "Mono replaces the previous note with a short fade. Each hit restarts both envelopes; simultaneous hits use the last scheduled note."),
    parameter("glide", "Glide", 0, 500, 5, "Pitch-slide time in Mono retrigger while the previous note is still sounding. Gaps start a fresh pitch; Polyphonic ignores Glide.", "ms"),
  ],
});
const quantizerParameters = () => pitch(
  optionParameter("quantizer", "Quantizer", ["Off", "On"], "Off passes V/Oct through without snapping, for external Quantizer blocks or continuous pitch. Root, octave and Tune still transpose."),
  optionParameter("root", "Root note", [...NOTE_NAMES], "Tonic used by the quantized V/Oct input."),
  optionParameter("scale", "Scale", SCALE_DEFS.map(({ name }) => name), "Allowed notes for incoming control voltage."),
  parameter("octave", "Base octave", 1, 6, 1, "Octave played at zero volts."),
);

export const VOICE_PARAMETER_SECTIONS: Record<VoiceId, VoiceParameterSection[]> = {
  kick: [
    tone(
      parameter("bodyLevel", "Body level", 0, 100, 1, "Level of the pitched body, independent of the click. 100 keeps the original level.", "%"),
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
    envelope(
      parameter("bodyAttack", "Body attack", 0, 30, 1, "Fade-in of the pitched body, independent of Decay and the click. 0 keeps the immediate onset; short bodies extend to finish the attack.", "ms"),
      parameter("bodyDecay", "Body length", 80, 1800, 10, "Time from the hit to the body decay endpoint, scaled by Decay.", "ms"),
    ),
  ],
  snare: [
    tone(
      parameter("toneFrequency", "Tone frequency", 80, 400, 1, "Fundamental pitch of the lower shell mode.", "Hz"),
      parameter("toneSpread", "Tone spread", 1.1, 2.4, 0.01, "Ratio between the two shell oscillators.", "×"),
      parameter("upperLevel", "Upper level", 0, 100, 1, "Upper shell tone relative to Tone level. 67 keeps the original balance; 0 leaves only the lower shell tone.", "%"),
      parameter("pitchAmount", "Pitch sweep", 1, 4, 0.05, "Starting pitch of both shell modes as a multiple of their resting pitch; 1 keeps pitch fixed.", "×"),
      parameter("pitchDecay", "Pitch decay", 5, 150, 1, "Time to reach the resting shell pitch, independent of the main Decay control.", "ms"),
      parameter("toneLevel", "Tone level", 0, 100, 1, "Level of the pitched shell oscillators.", "%"),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the snare noise layer.", "%"),
      parameter("noiseAttack", "Noise attack", 0, 40, 1, "Time for the noise to reach full level; 0 keeps the immediate crack. Very short noise lengths extend to finish the attack and decay.", "ms"),
      parameter("noiseFilter", "Noise filter", 300, 7000, 50, "Center or cutoff frequency of the noise layer.", "Hz"),
      parameter("noiseQ", "Filter resonance", 0.1, 8, 0.1, "Resonance of the noise filter.", "Q"),
    ),
    envelope(
      parameter("toneDecay", "Body length", 30, 600, 5, "Shell decay, independent of the snare wires; scaled by Decay.", "ms"),
      parameter("upperDecay", "Upper length", 0, 600, 5, "Independent upper shell decay, scaled by Decay. 0 follows Body length; positive values can shorten or extend the upper ring.", "ms"),
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
      parameter("filterFrequency", "Body filter", 300, 3500, 25, "Band-pass center frequency of the bursts and linked tail.", "Hz"),
      parameter("filterQ", "Filter resonance", 0.2, 6, 0.1, "Resonance of the burst and tail filters.", "Q"),
      parameter("tailFilter", "Tail filter", 0, 12000, 50, "Separate band-pass center for the tail, following Tune and Filter resonance. 0 shares the Body filter as before.", "Hz"),
    ),
    envelope(
      parameter("tailLevel", "Tail level", 0, 100, 1, "Level of the diffuse noise tail.", "%"),
      parameter("tailAttack", "Tail attack", 0, 80, 1, "Fade-in from the final burst, independent of Decay. 0 keeps the immediate tail; short tails extend to finish the attack.", "ms"),
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
    noise(
      optionParameter("noiseMode", "Noise envelope", ["Linked", "Independent"], "Linked keeps the original crack inside the tone envelope. Independent gives noise its own length and filter, even at zero Tone level."),
      parameter("noiseDecay", "Noise length", 5, 200, 1, "Crack length in Independent mode, scaled by Decay. Linked ignores this control.", "ms"),
      parameter("noiseFilter", "Noise filter", 0, 12000, 50, "Band-pass center in Independent mode, following Tune. 0 follows Body filter; Linked ignores this control.", "Hz"),
      parameter("noiseQ", "Noise resonance", 0, 12, 0.1, "Band-pass resonance in Independent mode. 0 follows Filter resonance; Linked ignores this control.", "Q"),
    ),
  ],
  ch: [
    tone(
      brightness(),
      parameter("metalLevel", "Metal level", 0, 100, 1, "Level of the six inharmonic oscillators.", "%"),
      parameter("metalBase", "Metal base", 20, 120, 1, "Base frequency used by the metallic oscillator bank.", "Hz"),
      parameter("highpass", "High-pass", 2000, 14000, 50, "Removes low frequencies from the metallic layer.", "Hz"),
      ...metalFilter(),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the broadband noise layer.", "%"),
      parameter("noiseHighpass", "Noise high-pass", 2000, 14000, 50, "High-pass cutoff for the noise layer.", "Hz"),
    ),
    envelope(
      parameter("duration", "Closed length", 15, 300, 1, "Noise length and linked metal length, scaled by Decay.", "ms"),
      parameter("metalDecay", "Metal length", 0, 300, 5, "Independent metallic decay; 0 follows Closed length. Scaled by Decay.", "ms"),
    ),
  ],
  oh: [
    {
      title: "Articulation",
      allMachines: true,
      parameters: [
        optionParameter("chokeMode", "Choke by", ["Off", "Closed hat"], "Closed-hat hits close this voice. Simultaneous hits favor the closed hat; works with every model."),
        parameter("chokeRelease", "Choke release", 5, 100, 1, "Fade time after a closed-hat hit. Existing effect tails continue ringing.", "ms"),
      ],
    },
    tone(
      brightness(),
      parameter("metalLevel", "Metal level", 0, 100, 1, "Level of the six inharmonic oscillators.", "%"),
      parameter("metalBase", "Metal base", 20, 120, 1, "Base frequency used by the metallic oscillator bank.", "Hz"),
      parameter("highpass", "High-pass", 2000, 14000, 50, "Removes low frequencies from the metallic layer.", "Hz"),
      ...metalFilter(),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the broadband noise layer.", "%"),
      parameter("noiseHighpass", "Noise high-pass", 2000, 14000, 50, "High-pass cutoff for the noise layer.", "Hz"),
    ),
    envelope(
      parameter("duration", "Open length", 80, 1800, 10, "Noise length and linked metal length, scaled by Decay.", "ms"),
      parameter("metalDecay", "Metal length", 0, 1800, 10, "Independent metallic decay; 0 follows Open length. Scaled by Decay. Choking closes both layers.", "ms"),
    ),
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
    envelope(
      parameter("duration", "Length", 40, 1200, 5, "Base length before the main Decay control is applied.", "ms"),
      parameter("highDamping", "High damping", 0, 100, 1, "Fade the High oscillator faster through the tail. 0 preserves the original equal decay; higher values favor the Low oscillator as the sound fades. Follows Length and Decay.", "%"),
    ),
  ],
  cym: [
    tone(
      brightness(),
      parameter("metalBase", "Metal base", 20, 120, 1, "Base frequency used by the metallic oscillator bank.", "Hz"),
      parameter("metalLevel", "Metal level", 0, 100, 1, "Level of the inharmonic oscillator bank.", "%"),
      parameter("highpass", "Metal high-pass", 1000, 10000, 50, "High-pass cutoff for the metallic layer.", "Hz"),
      ...metalFilter(),
    ),
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Level of the broadband noise wash.", "%"),
      parameter("noiseHighpass", "Noise high-pass", 1000, 12000, 50, "High-pass cutoff for the noise wash.", "Hz"),
    ),
    transient(
      parameter("stickLevel", "Stick level", 0, 100, 1, "Level of a short filtered-noise tick, separate from the wash and bell. 0 disables it; Brightness also shapes this layer.", "%"),
      parameter("stickFilter", "Stick filter", 800, 12000, 50, "Band-pass center of the stick tick. Lower values give a duller tap; higher values give a brighter tick. Follows Tune.", "Hz"),
      parameter("stickDecay", "Stick length", 10, 120, 1, "Length of the stick transient, independent of the main Decay control and other layer lengths.", "ms"),
    ),
    {
      title: "Bell",
      parameters: [
        parameter("bellLevel", "Bell level", 0, 100, 1, "Level of a separate pitched strike; 0 disables it. Brightness shapes the bell together with metal and noise.", "%"),
        parameter("bellFrequency", "Bell pitch", 200, 2000, 10, "Base pitch of the bell layer before Tune. Its upper partials fade faster than the fundamental.", "Hz"),
        parameter("bellDecay", "Bell length", 20, 2000, 10, "Bell decay independent of the metal and noise lengths, scaled by Decay.", "ms"),
      ],
    },
    envelope(
      parameter("duration", "Length", 100, 4000, 10, "Noise wash length and linked metal length, scaled by Decay.", "ms"),
      parameter("metalDecay", "Metal length", 0, 4000, 10, "Independent metallic decay; 0 follows Length. Scaled by Decay.", "ms"),
    ),
  ],
  shk: [
    noise(
      parameter("noiseLevel", "Noise level", 0, 100, 1, "Output level of the shaker noise.", "%"),
      parameter("filterFrequency", "Body filter", 1000, 12000, 50, "Band-pass center frequency of the shaker.", "Hz"),
      parameter("filterQ", "Filter resonance", 0.2, 8, 0.1, "Resonance of the shaker body filter.", "Q"),
    ),
    {
      title: "Texture",
      parameters: [
        parameter("grainDepth", "Grain depth", 0, 100, 1, "Break the smooth noise into short pulses with varying peaks. 0 keeps the original swish; deeper texture reduces the average level.", "%"),
        parameter("grainRate", "Grain rate", 20, 120, 1, "Pulses per second within each shake, independent of Tune and Decay. Lower rates give coarser rattles; longer shakes contain more grains.", "Hz"),
      ],
    },
    envelope(
      parameter("attack", "Attack", 1, 40, 1, "Time for the shaker to reach its peak.", "ms"),
      parameter("duration", "Length", 15, 600, 1, "Base length before the main Decay control is applied.", "ms"),
    ),
  ],
  bassline: [
    quantizerParameters(),
    synthArticulation(),
    tone(
      optionParameter("waveform", "Oscillator", ["Saw", "Square"], "Core oscillator shape."),
      parameter("pulseWidth", "Pulse width", 10, 90, 1, "Width of the Square oscillator's pulse. 50 keeps the original square; narrower or wider pulses change its harmonic balance. Saw ignores this control.", "%"),
      parameter("cutoff", "Filter cutoff", 80, 8000, 10, "Resting cutoff of the resonant low-pass filter.", "Hz"),
      filterTracking(),
      parameter("resonance", "Resonance", 0.1, 18, 0.1, "Emphasis around the filter cutoff.", "Q"),
      parameter("envelopeAmount", "Envelope amount", 0, 100, 1, "How far the filter opens on each note.", "%"),
    ),
    envelope(
      parameter("ampDecay", "Amplitude length", 0, 2400, 10, "Independent note decay; 0 follows Filter decay. Scaled by Decay.", "ms"),
      parameter("filterDecay", "Filter decay", 30, 1200, 5, "Time for the filter to return to its cutoff.", "ms"),
    ),
    {
      title: "Accent",
      parameters: [
        parameter("accent", "Accent", 0, 100, 1, "Strength of the level boost and optional filter accent.", "%"),
        optionParameter("accentSource", "Accent source", ["Every note", "Level modulation"], "Use a block or voice Level route: positive modulation scales Accent; midpoint and below are unaccented."),
        parameter("accentFilter", "Accent brightness", 0, 100, 1, "At full Accent, raises the filter envelope peak by up to two octaves.", "%"),
        parameter("accentDecay", "Accent length", 0, 100, 1, "At full Accent, extends filter decay up to twice its length. Linked amplitude follows.", "%"),
      ],
    },
  ],
  lead: [
    quantizerParameters(),
    synthArticulation(),
    tone(
      optionParameter("waveform", "Main oscillator", ["Saw", "Square", "Triangle"], "Primary oscillator shape."),
      parameter("pulseWidth", "Pulse width", 10, 90, 1, "Width of the Square main and companion pulses. 50 keeps their original squares. Saw, Triangle and the sub are unchanged; applied on the next note.", "%"),
      parameter("subLevel", "Sub oscillator", 0, 100, 1, "Sine one octave below the main oscillator, through the same filter.", "%"),
      parameter("pulseMix", "Companion mix", 0, 100, 1, "Level of the square companion oscillator, shaped by Companion interval, detune and Pulse width.", "%"),
      parameter("companionInterval", "Companion interval", -24, 24, 1, "Semitone offset from the main note, before Companion detune. Follows Glide; not separately quantized to the scale. 0 keeps the original register.", "st"),
      parameter("detune", "Companion detune", -30, 30, 1, "Detuning of the companion oscillator.", "ct"),
      parameter("cutoff", "Filter cutoff", 200, 12000, 25, "Resting cutoff of the low-pass filter.", "Hz"),
      filterTracking(),
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
    parameter("overtoneLevel", "Overtone", 0, 100, 1, "Level of a separate pitched shell mode. Raise this to hear Overtone ratio and Overtone length.", "%"),
    parameter("overtoneRatio", "Overtone ratio", 1, 4, 0.05, "Shell pitch relative to the resting body pitch. Follows Tune, without the body's pitch sweep; 1.5 keeps the original interval.", "×"),
    parameter("bodyLevel", "Body level", 0, 100, 1, "Level of the sine-wave drum body.", "%"),
  ),
  noise(
    parameter("noiseLevel", "Attack noise", 0, 100, 1, "Level of the short stick transient.", "%"),
    parameter("noiseFilter", "Noise filter", 150, 5000, 25, "Band-pass center frequency for the transient.", "Hz"),
  ),
  envelope(
    parameter("duration", "Length", 50, 1500, 5, "Body length before the main Decay control is applied.", "ms"),
    parameter("overtoneDecay", "Overtone length", 0, 1500, 5, "Independent shell decay, scaled by Decay. 0 follows 45% of Length, preserving the original shorter ring.", "ms"),
  ),
];

VOICE_PARAMETER_SECTIONS.lt = tomSections("Low tom");
VOICE_PARAMETER_SECTIONS.mt = tomSections("Mid tom");
VOICE_PARAMETER_SECTIONS.ht = tomSections("High tom");

export const DEFAULT_CUSTOM_VOICE_SETTINGS: Record<VoiceId, CustomVoiceSettings> = {
  kick: { bodyLevel: 100, bodyAttack: 0, bodyTone: 0, bodyFrequency: 50, pitchAmount: 5.5, pitchDecay: 55, clickLevel: 32, clickFrequency: 1800, clickDecay: 16, bodyDecay: 620 },
  snare: { upperLevel: 67, upperDecay: 0, pitchAmount: 1, pitchDecay: 30, noiseAttack: 0, toneDecay: 130, toneFrequency: 185, toneSpread: 1.62, toneLevel: 42, noiseLevel: 80, noiseFilter: 1800, noiseQ: 0.9, noiseDecay: 260 },
  clap: { tailFilter: 0, tailAttack: 0, burstDecay: 18, burstCount: 3, burstSpacing: 11, burstLevel: 55, filterFrequency: 1080, filterQ: 1.1, tailLevel: 50, tailDecay: 220 },
  rim: { noiseFilter: 0, noiseQ: 0, noiseMode: 0, noiseDecay: 20, balance: 50, lowFrequency: 1670, highFrequency: 2350, filterFrequency: 1750, filterQ: 3.5, toneLevel: 70, noiseLevel: 25, duration: 35 },
  ch: { metalFocus: 9000, metalQ: 0.9, metalDecay: 0, lowpass: 20000, metalLevel: 50, metalBase: 40, highpass: 7400, noiseLevel: 18, noiseHighpass: 7800, duration: 58 },
  oh: { metalFocus: 9000, metalQ: 0.9, metalDecay: 0, chokeMode: 0, chokeRelease: 10, lowpass: 20000, metalLevel: 48, metalBase: 40, highpass: 7000, noiseLevel: 30, noiseHighpass: 7600, duration: 420 },
  lt: { overtoneRatio: 1.5, overtoneDecay: 0, overtoneLevel: 0, bodyFrequency: 92, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 368, duration: 450 },
  mt: { overtoneRatio: 1.5, overtoneDecay: 0, overtoneLevel: 0, bodyFrequency: 138, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 552, duration: 450 },
  ht: { overtoneRatio: 1.5, overtoneDecay: 0, overtoneLevel: 0, bodyFrequency: 196, pitchAmount: 1.7, pitchDecay: 70, bodyLevel: 90, noiseLevel: 18, noiseFilter: 784, duration: 450 },
  cow: { highDamping: 0, balance: 50, lowFrequency: 540, highFrequency: 800, filterFrequency: 2640, filterQ: 1.4, toneLevel: 55, duration: 360 },
  cym: { metalFocus: 9000, metalQ: 0.9, stickLevel: 0, stickFilter: 4500, stickDecay: 15, bellLevel: 0, bellFrequency: 800, bellDecay: 500, metalDecay: 0, lowpass: 20000, metalBase: 40, metalLevel: 40, highpass: 4200, noiseLevel: 32, noiseHighpass: 5200, duration: 1400 },
  shk: { grainDepth: 0, grainRate: 60, noiseLevel: 50, filterFrequency: 6200, filterQ: 1.6, attack: 6, duration: 75 },
  bassline: { quantizer: 1, pulseWidth: 50, filterTracking: 0, playMode: 0, glide: 0, accentSource: 0, accentFilter: 0, accentDecay: 0, ampDecay: 0, root: 0, scale: 2, octave: 2, waveform: 0, cutoff: 700, resonance: 12, envelopeAmount: 82, filterDecay: 260, accent: 30 },
  lead: { quantizer: 1, companionInterval: 0, pulseWidth: 50, filterTracking: 0, playMode: 0, glide: 0, filterDecay: 0, subLevel: 0, root: 0, scale: 1, octave: 4, waveform: 0, pulseMix: 28, detune: 7, cutoff: 3200, resonance: 3.5, envelopeAmount: 38, attack: 8, release: 520 },
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
