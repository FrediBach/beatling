import type { VoiceId } from "@/lib/types";

export type VoiceDiagramKind = "pitch" | "partials" | "bursts" | "metal" | "texture" | "oscillator";
export interface VoiceEditorPanel {
  title: string;
  description: string;
  keys: string[];
  diagram?: VoiceDiagramKind;
  dial?: string;
  allMachines?: boolean;
}

const panel = (title: string, description: string, keys: string[], diagram?: VoiceDiagramKind, dial?: string): VoiceEditorPanel => ({ title, description, keys, diagram, dial });
const articulation: VoiceEditorPanel = panel("Playback & glide", "Let notes overlap, or replace each note and slide into the next pitch. Glide applies while a previous mono note is still sounding.", ["playMode", "glide"]);
const quantizer = panel("Notes & scale", "Choose a scale, or switch Quantizer off to use an external Quantizer block or continuous pitch. Root, octave and Tune still transpose.", ["quantizer", "root", "scale", "octave"]);
const synthFilter = panel("Filter movement", "Cutoff sets the resting brightness. The envelope opens the filter on each hit, then falls back; resonance emphasizes its edge.", ["cutoff", "resonance", "envelopeAmount", "filterDecay", "filterTracking"], undefined, "cutoff");
const choke: VoiceEditorPanel = { ...panel("Closed-hat interaction", "Let the open hat ring freely, or have closed-hat hits cut it short. Choke release softens that cut; effect tails keep ringing.", ["chokeMode", "chokeRelease"]), allMachines: true };
const metal = panel("Metallic body", "Six differently tuned square waves make the metallic ring. Focus selects a frequency band; resonance narrows it. High-pass removes the lows.", ["metalLevel", "metalBase", "metalFocus", "metalQ", "highpass", "metalDecay"], "metal");
const wash = panel("Noise & length", "Noise adds an airy wash around the metal. Its length also sets the metal tail when Metal length is 0.", ["noiseLevel", "noiseHighpass", "duration"]);
const brightness = panel("Overall brightness", "Soften all layers together. At 20000 Hz the brightness filter is bypassed.", ["lowpass"]);
const tom = (): VoiceEditorPanel[] => [
  panel("Pitched body", "A falling sine tone gives the drum its weight. Pitch sweep sets the starting pitch; Pitch decay controls how quickly it settles.", ["bodyFrequency", "bodyLevel", "pitchAmount", "pitchDecay", "duration"], "pitch"),
  panel("Shell overtone", "Add a second ringing tone above the body. Its ratio sets the interval; length shapes the ring independently. 0 ms follows 45% of the body length.", ["overtoneLevel", "overtoneRatio", "overtoneDecay"]),
  panel("Stick attack", "A short burst of noise defines the strike. Raise the filter for a brighter tap.", ["noiseLevel", "noiseFilter"]),
];

/** Presentation groups only: ranges, defaults and persistence stay in voice-config. */
export const VOICE_EDITOR_PANELS: Record<VoiceId, VoiceEditorPanel[]> = {
  kick: [
    panel("Pitched body", "Start with the low fundamental, then add harmonics to make the kick speak on smaller speakers. Attack softens the onset; length sets the body tail.", ["bodyFrequency", "bodyTone", "bodyLevel", "bodyAttack", "bodyDecay"], undefined, "bodyFrequency"),
    panel("Pitch punch", "The pitch starts above the fundamental and drops into it. A larger sweep adds punch; a longer fall makes the bend audible.", ["pitchAmount", "pitchDecay"], "pitch"),
    panel("Attack click", "A separate noise click cuts through the mix. Its filter removes lows, and its decay stays independent of the body.", ["clickLevel", "clickFrequency", "clickDecay"]),
  ],
  snare: [
    panel("Shell & pitch", "Two pitched shell modes sit underneath the snare wires. Add a pitch drop for a harder strike; 1× keeps the pitch steady.", ["toneFrequency", "toneLevel", "toneDecay", "pitchAmount", "pitchDecay"], "pitch"),
    panel("Upper shell", "Spread tunes the upper shell relative to the lower one. Balance its level and ring; 0 ms follows Body length.", ["toneSpread", "upperLevel", "upperDecay"]),
    panel("Snare wires", "Filtered noise supplies the crack and sizzle. A short attack snaps immediately; a slower attack lets the shell arrive first.", ["noiseLevel", "noiseAttack", "noiseDecay", "noiseFilter", "noiseQ"]),
  ],
  clap: [
    panel("Handclap bursts", "Several short impulses make a clap feel like multiple hands. Space them apart for a flam, or overlap longer bursts for a denser strike.", ["burstCount", "burstSpacing", "burstDecay", "burstLevel"], "bursts"),
    panel("Diffuse tail", "The noise tail starts with the last burst. Fade it in for a softer bloom; 0 Hz keeps its filter linked to the bursts.", ["tailLevel", "tailAttack", "tailDecay", "tailFilter"]),
    panel("Burst color", "The band-pass filter gives the handclaps their body. Resonance also shapes the tail, even when its frequency is independent.", ["filterFrequency", "filterQ"]),
  ],
  rim: [
    panel("Pitched body", "Blend two square-wave partials, then shape their shared resonance. Short lengths give a dry knock; longer lengths reveal the ring.", ["balance", "lowFrequency", "highFrequency", "filterFrequency", "filterQ", "toneLevel", "duration"], "partials"),
    panel("Noise crack", "Add a sharp noise attack. Linked noise passes through the body filter and envelope; Independent gives the crack its own length, filter and output.", ["noiseMode", "noiseLevel", "noiseDecay", "noiseFilter", "noiseQ"]),
  ],
  ch: [metal, wash, brightness],
  oh: [metal, wash, choke, brightness],
  lt: tom(), mt: tom(), ht: tom(),
  cow: [
    panel("Two oscillators", "Blend two square waves to set the bell’s interval and character. The middle gives both equal weight.", ["balance", "lowFrequency", "highFrequency"], "partials"),
    panel("Body & ring", "Focus the oscillator pair with a resonant band-pass. High damping makes the upper oscillator fade sooner, leaving a darker tail.", ["toneLevel", "filterFrequency", "filterQ", "duration", "highDamping"]),
  ],
  cym: [
    metal, wash,
    panel("Stick strike", "Add a short tick at the front of the cymbal. Its length is independent of the main Decay control. Set the level to 0 to leave it out.", ["stickLevel", "stickFilter", "stickDecay"]),
    panel("Pitched bell", "Layer a separate bell over the wash. Tune and length shape its ringing center; set the level to 0 to leave it out.", ["bellLevel", "bellFrequency", "bellDecay"]),
    brightness,
  ],
  shk: [
    panel("Grain texture", "Break the smooth swish into small pulses. Depth reveals the grains; rate moves from a coarse rattle to a fine shimmer.", ["grainDepth", "grainRate"], "texture"),
    panel("Noise color", "The band-pass selects the shaker’s frequency range. Higher resonance makes a narrower, more focused sound.", ["noiseLevel", "filterFrequency", "filterQ"]),
    panel("Shake envelope", "Attack controls the swell into each shake. Length sets the fade, scaled by the main Decay control.", ["attack", "duration"]),
  ],
  bassline: [
    panel("Oscillator", "Saw has a bright, buzzy edge. Square sounds hollow; changing its pulse width gives thinner or fuller colors.", ["waveform", "pulseWidth"], "oscillator"),
    synthFilter,
    panel("Amplitude", "Set the note’s own length, or use 0 ms to follow the filter decay, including accent length changes.", ["ampDecay"]),
    panel("Accent", "Emphasize every note, or let positive Level modulation select the accents. Add brightness and length to make accented notes speak.", ["accentSource", "accent", "accentFilter", "accentDecay"], undefined, "accent"),
    articulation, quantizer,
  ],
  lead: [
    panel("Main oscillator", "Choose the main tone. Pulse width shapes any square waves, including the companion; the sub adds a sine one octave below.", ["waveform", "pulseWidth", "subLevel"], "oscillator"),
    panel("Companion oscillator", "Blend in a square wave for thickness or harmony. Set its interval in semitones, then detune in cents for a gentle beating texture.", ["pulseMix", "companionInterval", "detune"]),
    synthFilter,
    panel("Amplitude envelope", "Attack softens the front of each note; Release sets its tail. A Filter decay of 0 follows Release.", ["attack", "release"]),
    articulation, quantizer,
  ],
};
