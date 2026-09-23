import { SYNTH_VOICE_IDS } from "./constants";
import { DEFAULT_CUSTOM_VOICE_SETTINGS, normalizeCustomVoiceSettings } from "./voice-config";
import type { CustomVoiceSettings, VoiceId, VoiceState } from "./types";

export interface VoicePreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly settings: Readonly<CustomVoiceSettings>;
}

type PresetRecipe = readonly [id: string, name: string, description: string, settings: CustomVoiceSettings];

function tomRecipes(frequency: number): PresetRecipe[] {
  return [
    ["muted", "Muted skin", "A short, rounded hit with a soft stick attack.", { bodyFrequency: frequency, pitchAmount: 1.3, pitchDecay: 35, noiseLevel: 10, duration: 180 }],
    ["resonant", "Resonant shell", "A ringing shell overtone above a gentle pitch drop.", { bodyFrequency: frequency, pitchAmount: 1.5, pitchDecay: 60, overtoneLevel: 35, overtoneRatio: 1.75, overtoneDecay: 550, noiseLevel: 12, duration: 700 }],
    ["disco", "Disco sweep", "A pronounced falling pitch and bright stick transient.", { bodyFrequency: frequency, pitchAmount: 3.2, pitchDecay: 150, overtoneLevel: 15, overtoneRatio: 2.5, overtoneDecay: 120, noiseLevel: 25, noiseFilter: 2200, duration: 400 }],
  ];
}

const RECIPES: Record<VoiceId, readonly PresetRecipe[]> = {
  kick: [
    ["sub", "Deep sub", "A long, low sine body with a restrained click.", { bodyFrequency: 38, pitchAmount: 3, pitchDecay: 65, clickLevel: 10, bodyDecay: 1100 }],
    ["punch", "Tight punch", "A short body and fast pitch snap for busy grooves.", { bodyFrequency: 60, bodyTone: 25, pitchAmount: 7, pitchDecay: 25, clickLevel: 45, clickFrequency: 3200, clickDecay: 10, bodyDecay: 280 }],
    ["knock", "Warehouse knock", "A harmonically rich body with a hard, bright attack.", { bodyFrequency: 48, bodyTone: 75, bodyLevel: 85, pitchAmount: 9, pitchDecay: 40, clickLevel: 55, clickFrequency: 4500, bodyDecay: 450 }],
  ],
  snare: [
    ["dry", "Dry snap", "A tight shell and short, bright wire noise.", { toneFrequency: 220, toneDecay: 80, upperDecay: 55, noiseFilter: 3200, noiseDecay: 120, noiseLevel: 65 }],
    ["deep", "Deep backbeat", "A low shell with a small pitch drop and broad noise tail.", { toneFrequency: 140, toneLevel: 55, pitchAmount: 1.5, pitchDecay: 35, toneDecay: 220, upperLevel: 40, noiseFilter: 1500, noiseDecay: 330 }],
    ["brush", "Soft brush", "A softened noise attack with very little pitched body.", { toneLevel: 12, upperLevel: 25, noiseLevel: 60, noiseAttack: 15, noiseFilter: 4000, noiseQ: 0.5, noiseDecay: 450 }],
  ],
  clap: [
    ["tight", "Tight hands", "Two close cracks with a short, dry tail.", { burstCount: 2, burstSpacing: 7, burstDecay: 12, filterFrequency: 1500, tailLevel: 25, tailDecay: 90 }],
    ["crowd", "Loose crowd", "Five staggered handclaps opening into a diffuse tail.", { burstCount: 5, burstSpacing: 18, burstDecay: 24, burstLevel: 45, filterFrequency: 1200, tailFilter: 2200, tailAttack: 12, tailLevel: 45, tailDecay: 380 }],
    ["soft", "Soft wash", "Soft overlapping bursts followed by a darker, swelling tail.", { burstCount: 3, burstSpacing: 15, burstDecay: 35, burstLevel: 30, filterFrequency: 900, filterQ: 0.7, tailFilter: 700, tailAttack: 35, tailLevel: 55, tailDecay: 600 }],
  ],
  rim: [
    ["wood", "Woodblock", "A low, dry knock with almost no noise.", { lowFrequency: 800, highFrequency: 1230, balance: 30, filterFrequency: 1000, filterQ: 2, noiseLevel: 5, duration: 55 }],
    ["clave", "Bright clave", "A high, focused pair of partials with a clean tail.", { lowFrequency: 2200, highFrequency: 3300, balance: 40, filterFrequency: 2750, filterQ: 5, noiseLevel: 0, duration: 80 }],
    ["crack", "Noisy crack", "A short rim strike with its own bright noise envelope.", { toneLevel: 50, duration: 25, noiseMode: 1, noiseLevel: 55, noiseDecay: 65, noiseFilter: 4500, noiseQ: 0.8 }],
  ],
  ch: [
    ["tick", "Crisp tick", "A very short metallic tick with a bright noise edge.", { duration: 28, metalDecay: 20, metalBase: 55, metalLevel: 45, noiseLevel: 25, highpass: 8500, noiseHighpass: 9500 }],
    ["dust", "Dusty hat", "A darker, softer hat centered in the upper mids.", { duration: 85, lowpass: 6500, highpass: 3500, noiseHighpass: 4000, metalFocus: 5000, metalQ: 1.2, metalLevel: 35, noiseLevel: 30 }],
    ["sizzle", "Metal sizzle", "A resonant metallic tail with a short noise attack.", { duration: 45, metalDecay: 180, metalBase: 65, metalFocus: 7500, metalQ: 2.5, highpass: 5000, noiseLevel: 12 }],
  ],
  oh: [
    ["choked", "Choked disco", "A bright open hat that closes on closed-hat hits.", { duration: 650, metalDecay: 450, metalBase: 50, noiseLevel: 35, chokeMode: 1, chokeRelease: 10 }],
    ["dark", "Dark shimmer", "A lower metallic focus and long, softened wash.", { duration: 900, metalDecay: 1100, lowpass: 8000, highpass: 3000, noiseHighpass: 4500, metalFocus: 5500, metalQ: 1.4, noiseLevel: 22 }],
    ["short", "Short splash", "A quick, airy splash with a restrained metal layer.", { duration: 220, metalDecay: 150, metalLevel: 30, noiseLevel: 45, highpass: 8500, noiseHighpass: 9000 }],
  ],
  lt: tomRecipes(80),
  mt: tomRecipes(130),
  ht: tomRecipes(205),
  cow: [
    ["low", "Low bell", "A low, hollow oscillator pair with a rounded tail.", { lowFrequency: 350, highFrequency: 525, filterFrequency: 1600, balance: 35, duration: 500, highDamping: 45 }],
    ["agogo", "High agogo", "A bright, ringing bell with a strong upper oscillator.", { lowFrequency: 800, highFrequency: 1200, filterFrequency: 3600, filterQ: 2, balance: 65, duration: 600 }],
    ["muted", "Muted bell", "A short bell whose upper partial fades quickly.", { duration: 120, highDamping: 85, balance: 40, filterFrequency: 2200, filterQ: 1 }],
  ],
  cym: [
    ["ride", "Bell ride", "A distinct stick tick and pitched bell over a restrained wash.", { metalLevel: 25, noiseLevel: 12, duration: 800, metalDecay: 1100, stickLevel: 40, stickFilter: 6000, stickDecay: 20, bellLevel: 45, bellFrequency: 900, bellDecay: 700 }],
    ["crash", "Bright crash", "A broad, bright wash with a long metallic decay.", { metalLevel: 50, noiseLevel: 45, duration: 2400, metalDecay: 1800, metalBase: 55, highpass: 3500, noiseHighpass: 4500, stickLevel: 15 }],
    ["dark", "Dark gong", "A low metallic bloom with a deep bell and softened highs.", { lowpass: 6000, metalBase: 25, highpass: 1500, metalFocus: 3000, metalQ: 2, noiseHighpass: 2000, noiseLevel: 18, duration: 2800, metalDecay: 3200, bellLevel: 30, bellFrequency: 300, bellDecay: 1600 }],
  ],
  shk: [
    ["egg", "Soft egg", "A short, smooth shake with a gentle attack.", { filterFrequency: 5000, filterQ: 0.9, attack: 10, duration: 90, noiseLevel: 45 }],
    ["cabasa", "Cabasa", "Coarse, distinct grains in a longer, lower shake.", { filterFrequency: 4000, filterQ: 1.2, grainDepth: 80, grainRate: 40, attack: 4, duration: 220, noiseLevel: 60 }],
    ["sand", "Fine sand", "Bright, fine grains with a quick attack.", { filterFrequency: 9000, filterQ: 0.8, grainDepth: 55, grainRate: 110, attack: 2, duration: 130, noiseLevel: 55 }],
  ],
  bassline: [
    ["round", "Round bass", "A mellow square bass with a subtle filter pluck.", { waveform: 1, cutoff: 350, resonance: 2, envelopeAmount: 25, filterDecay: 180, ampDecay: 400, accent: 10, filterTracking: 50 }],
    ["acid", "Acid slide", "A narrow pulse with resonant accents and mono glide.", { waveform: 1, pulseWidth: 30, cutoff: 450, resonance: 15, envelopeAmount: 90, filterDecay: 350, accent: 45, accentFilter: 35, accentDecay: 25, playMode: 1, glide: 90 }],
    ["pluck", "Saw pluck", "A crisp saw bass with a short, tracked filter sweep.", { cutoff: 900, resonance: 5, envelopeAmount: 60, filterDecay: 120, ampDecay: 180, accent: 15, filterTracking: 70 }],
  ],
  lead: [
    ["soft", "Soft triangle", "A rounded triangle with a soft entrance and long release.", { waveform: 2, pulseMix: 0, subLevel: 15, cutoff: 1800, resonance: 1.2, envelopeAmount: 20, attack: 80, release: 1100, filterTracking: 60 }],
    ["fifth", "Fifth stack", "A bright saw lead with a companion a fifth above.", { waveform: 0, pulseMix: 40, companionInterval: 7, detune: 10, subLevel: 20, cutoff: 4200, resonance: 2.5, envelopeAmount: 45, attack: 5, release: 450, filterDecay: 220 }],
    ["glide", "Pulse glide", "A narrow, resonant pulse lead with smooth mono slides.", { waveform: 1, pulseWidth: 25, pulseMix: 20, detune: -8, cutoff: 2400, resonance: 6, envelopeAmount: 50, filterTracking: 75, playMode: 1, glide: 140, attack: 5, release: 700, filterDecay: 300 }],
  ],
};

// Quantizer choices belong to the composition, so sound presets neither replace
// them nor use them to determine whether the current sound matches a preset.
const QUANTIZER_KEYS = new Set(["root", "scale", "octave"]);

function createPresets(voiceId: VoiceId): readonly VoicePreset[] {
  const recipes: readonly PresetRecipe[] = [
    ["default", "Default", "The original synthesis sound for this voice.", {}],
    ...RECIPES[voiceId],
  ];
  return recipes.map(([id, name, description, overrides]) => {
    const normalized = normalizeCustomVoiceSettings(voiceId, { ...DEFAULT_CUSTOM_VOICE_SETTINGS[voiceId], ...overrides });
    const settings = Object.fromEntries(Object.entries(normalized).filter(([key]) => !SYNTH_VOICE_IDS.has(voiceId) || !QUANTIZER_KEYS.has(key)));
    return { id, name, description, settings };
  });
}

export const VOICE_PRESETS = Object.fromEntries(
  (Object.keys(RECIPES) as VoiceId[]).map((id) => [id, createPresets(id)]),
) as Record<VoiceId, readonly VoicePreset[]>;

export function matchingVoicePreset(voiceId: VoiceId, custom: CustomVoiceSettings): VoicePreset | undefined {
  const normalized = normalizeCustomVoiceSettings(voiceId, custom);
  return VOICE_PRESETS[voiceId].find((preset) => Object.entries(preset.settings).every(([key, value]) => normalized[key] === value));
}

export function applyVoicePreset(voiceId: VoiceId, voice: VoiceState, presetId: string): VoiceState {
  const preset = VOICE_PRESETS[voiceId].find(({ id }) => id === presetId);
  if (!preset) return voice;
  return { ...voice, custom: { ...voice.custom, ...preset.settings } };
}
