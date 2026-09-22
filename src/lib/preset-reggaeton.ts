import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–3 retain the six-hit kick, displaced snare, sixteenth shaker and open hat.
const BASS = 4;
const LEAD = 5;
const CLAP = 6;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const SHAKER_ACCENT = 14;
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

/** Curate an owned patch: minor bass response, layered clap lift, sparse break, two clap pickups. */
export function refineReggaeton(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 24, tune: 0 });
  Object.assign(voices.snare, { level: 59, decay: 30, tune: 1 });
  Object.assign(voices.shk, { level: 27, decay: 18 });
  Object.assign(voices.oh, { level: 30, decay: 28 });
  Object.assign(voices.clap, { level: 34, decay: 26 });
  voices.shk.modulations = [{ source: `${SHAKER_ACCENT}`, destination: "level", amount: 0.32 }];
  voices.clap.modulations = [{ source: `${SHAKER_ACCENT}`, destination: "level", amount: 0.24 }];
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.25 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.12 },
  ];

  // A short saw bass climbs G–B-flat–D, then answers C–B-flat–A. Triangle
  // 101 notes on B-flat/E-flat return to G at the start of the second bar.
  Object.assign(voices.bassline, { level: 54, decay: 38 });
  Object.assign(voices.bassline.custom, {
    root: 7, scale: 2, octave: 2, waveform: 0, cutoff: 400,
    resonance: 3, envelopeAmount: 40, filterDecay: 180, accent: 14,
  });
  Object.assign(voices.lead, { level: 30, decay: 28 });
  Object.assign(voices.lead.custom, {
    root: 7, scale: 2, octave: 3, waveform: 2, pulseMix: 22, detune: 3,
    cutoff: 2500, resonance: 1.8, envelopeAmount: 24, attack: 4, release: 200,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 1, 4, 1);
  const lead = setLane(patch, LEAD, "lead", 2, 5);
  ending(lead, 1, 1, 1);
  const clap = setLane(patch, CLAP, "clap", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 30, shape: "tri" });
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, SHAKER_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 8, rot: 4, shape: "sqr" });

  const [kick, snare, shaker, openHat] = patch.blocks;
  ending(openHat, 3, 0, 0);
  // Keep the dense percussion clear: bass-only saturation, a small room,
  // and filtered dotted echoes reserved for the melodic response.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 16, tone: 2200, return: 34 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 750, damping: 4700, return: 42 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 20, lowCut: 1000, tone: 3500, return: 42 });
  effects.sends.bassline.distortion = 32;
  effects.sends.snare.reverb = 28;
  effects.sends.clap.reverb = 24;
  effects.sends.lead.reverb = 32;
  effects.sends.lead.delay = 48;

  if (variation === 1) {
    Object.assign(bass, { pulses: 4, rot: 15 });
    ending(lead, 1, 2, 3);
    Object.assign(clap, { pulses: 2, rot: 9 });
    Object.assign(openHat, { repeats: 1, series: [] });
    voices.shk.level = 29;
    voices.bassline.custom.cutoff = 600;
    voices.lead.custom.cutoff = 3000;
  } else if (variation === 2) {
    kick.pulses = 2;
    Object.assign(snare, { pulses: 2, rot: 13 });
    shaker.pulses = 4;
    openHat.mute = true;
    ending(bass, 1, 1, 1);
    lead.pulses = 1;
    voices.bassline.custom.cutoff = 260;
    Object.assign(voices.lead.custom, { cutoff: 1300, release: 420 });
    effects.sends.bassline.distortion = 20;
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Keep every kick and snare. Bass and lead release early, then claps
    // at 26/29 anticipate the last two kick hits; the second clap is softer.
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 2, rot: 7, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 0, 0);
    ending(openHat, 1, 1, 6);
    clap.series = [
      { id: `${clap.rhythmId}-wait`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
      { id: `${clap.rhythmId}-call`, steps: 4, pulses: 1, rot: 2, repeats: 1 },
      { id: `${clap.rhythmId}-reply`, steps: 4, pulses: 1, rot: 3, repeats: 1 },
    ];
    shaker.series = [
      { id: `${shaker.rhythmId}-short`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${shaker.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
