import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–4 retain the kick, backbeat/ghost snare, shuffled hats and open hats.
const BASS = 5;
const LEAD = 6;
const RIM = 7;
const CLAP = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const SNARE_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: low bass hook, clap lift, kick break, descending bass pickup. */
export function refineSpeedGarage(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 34, tune: 0 });
  Object.assign(voices.snare, { level: 58, decay: 30 });
  Object.assign(voices.ch, { level: 32, decay: 16 });
  Object.assign(voices.oh, { level: 35, decay: 26 });
  Object.assign(voices.rim, { level: 35, decay: 20 });
  Object.assign(voices.clap, { level: 30, decay: 28 });
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.3 }];
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.34 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.2 },
  ];

  // F-sharp–A–C-sharp–A repeats with the last pair displaced in bar two.
  // A low square 303 carries the hook; detuned square 101 stabs answer above it.
  Object.assign(voices.bassline, { level: 59, decay: 38 });
  Object.assign(voices.bassline.custom, {
    root: 6, scale: 2, octave: 1, waveform: 1, cutoff: 320,
    resonance: 2.8, envelopeAmount: 38, filterDecay: 280, accent: 18,
  });
  Object.assign(voices.lead, { level: 30, decay: 32 });
  Object.assign(voices.lead.custom, {
    root: 6, scale: 2, octave: 3, waveform: 1, pulseMix: 28, detune: 12,
    cutoff: 1600, resonance: 2.2, envelopeAmount: 32, attack: 4, release: 260,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 },
    { source: `${HAT_ACCENT}`, destination: "level", amount: 0.18 },
    { source: `${HAT_ACCENT}`, destination: "decay", amount: 0.1 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 4, 2);
  bass.series = [
    { id: `${bass.rhythmId}-answer`, steps: 8, pulses: 2, rot: 6, repeats: 1 },
    { id: `${bass.rhythmId}-pickup`, steps: 8, pulses: 2, rot: 5, repeats: 1 },
  ];
  const lead = setLane(patch, LEAD, "lead", 1, 7);
  const rim = setLane(patch, RIM, "rim", 0);
  ending(rim, 3, 1, 13);
  const clap = setLane(patch, CLAP, "clap", 0);
  setLane(patch, BASS_PITCH, "", 1, 2).shape = "tri";
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [kick, , ghostSnare, hats, openHat] = patch.blocks;
  ending(openHat, 3, 2, 2);
  // Soft saturation adds bass harmonics. Keep both low voices out of
  // the room and echo, reserving the filtered eighth-note return for the 101.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 18, trim: -2, tone: 2400, return: 36 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 18, lowCut: 850, damping: 3900, return: 42 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 26, lowCut: 800, tone: 2600, return: 44 });
  effects.sends.bassline.distortion = 42;
  effects.sends.snare.reverb = 24;
  effects.sends.rim.reverb = 18;
  effects.sends.clap.reverb = 30;
  effects.sends.lead.reverb = 38;
  effects.sends.lead.delay = 54;

  if (variation === 1) {
    Object.assign(bass, { steps: 8, pulses: 2, rot: 6 });
    bass.series.unshift({ id: `${bass.rhythmId}-lift`, steps: 8, pulses: 4, rot: 1, repeats: 1 });
    Object.assign(lead, { pulses: 2, rot: 13 });
    ending(lead, 1, 1, 7);
    Object.assign(clap, { pulses: 2, rot: 12 });
    Object.assign(openHat, { repeats: 1, series: [] });
    ending(rim, 3, 2, 5);
    Object.assign(voices.bassline.custom, { cutoff: 520, resonance: 3.8, envelopeAmount: 48 });
    voices.lead.custom.cutoff = 2200;
  } else if (variation === 2) {
    kick.mute = true;
    ghostSnare.mute = true;
    openHat.mute = true;
    rim.mute = true;
    Object.assign(hats, { pulses: 4, rot: 2 });
    bass.pulses = 2;
    bass.series[0].pulses = 1;
    bass.series[1].pulses = 1;
    ending(lead, 1, 1, 15);
    voices.bassline.custom.cutoff = 150;
    Object.assign(voices.lead.custom, { cutoff: 1000, release: 540 });
    effects.sends.bassline.distortion = 24;
    effects.sends.lead.delay = 64;
  } else if (variation === 3) {
    // Keep the floor kick and backbeat. The hats and lead leave the last
    // beat clear for C-sharp–C-sharp–B–A bass notes returning to F-sharp.
    bass.series[0].pulses = 1;
    Object.assign(bass.series[1], { pulses: 4, rot: 1 });
    voices.bassline.decay = 24;
    voices.bassline.custom.filterDecay = 140;
    ending(lead, 1, 0, 0);
    ending(ghostSnare, 1, 0, 0);
    rim.mute = true;
    for (const block of [hats, openHat]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === hats ? 9 : 3, rot: block === hats ? 0 : 10, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
