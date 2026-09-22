import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–2 retain the original eighth-note kick, half-time snare and crash.
const BASS = 3;
const LEAD = 4;
const HATS = 5;
const OPEN_HAT = 6;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const KICK_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: clipped kick drive, synth lift, sparse break, final kick burst. */
export function refineGabberAdjacent(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 10, tune: 0 });
  Object.assign(voices.snare, { level: 60, decay: 22 });
  Object.assign(voices.cym, { level: 32, decay: 18 });
  Object.assign(voices.ch, { level: 23, decay: 10 });
  Object.assign(voices.oh, { level: 29, decay: 14 });
  voices.kick.modulations = [
    { source: `${KICK_ACCENT}`, destination: "level", amount: 0.18 },
    { source: `${KICK_ACCENT}`, destination: "decay", amount: 0.12 },
  ];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.24 }];

  // The 303 alternates whole bars of G and D, with short odd-step notes
  // between the kick attacks. A detuned saw 101 answers G–F–C above it.
  Object.assign(voices.bassline, { level: 49, decay: 22 });
  Object.assign(voices.bassline.custom, {
    root: 7, scale: 5, octave: 2, waveform: 0, cutoff: 650,
    resonance: 6.2, envelopeAmount: 56, filterDecay: 80, accent: 20,
  });
  Object.assign(voices.lead, { level: 29, decay: 24 });
  Object.assign(voices.lead.custom, {
    root: 7, scale: 5, octave: 3, waveform: 0, pulseMix: 42, detune: 14,
    cutoff: 3200, resonance: 3.4, envelopeAmount: 32, attack: 2, release: 130,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 10 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 1, 4, 3);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 1, 7);
  const hats = setLane(patch, HATS, "ch", 4, 3);
  const openHat = setLane(patch, OPEN_HAT, "oh", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  setLane(patch, LEAD_PITCH, "", 1, 3).shape = "tri";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 8, shape: "sqr" });
  Object.assign(setLane(patch, KICK_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [kick, , cymbal] = patch.blocks;
  cymbal.series = [{ id: `${cymbal.rhythmId}-rest`, steps: 16, pulses: 0, rot: 0, repeats: 3 }];
  // The kick owns the clipped return. Small, high-passed ambience and a
  // sixteenth-note lead echo keep the rapid low end out of the tail buses.
  Object.assign(effects.distortion, { enabled: true, mode: "hard", drive: 58, trim: -5, tone: 3600, return: 40 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 0, lowCut: 1100, damping: 4400, return: 38 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/16", feedback: 14, lowCut: 1500, tone: 4200, return: 38 });
  effects.sends.kick.distortion = 54;
  effects.sends.bassline.distortion = 20;
  effects.sends.snare.reverb = 22;
  effects.sends.lead.reverb = 20;
  effects.sends.lead.delay = 40;

  if (variation === 1) {
    bass.pulses = 8;
    lead.pulses = 4;
    ending(lead, 1, 2, 7);
    Object.assign(hats, { pulses: 8, rot: 15 });
    ending(openHat, 3, 2, 7);
    cymbal.series[0].repeats = 1;
    Object.assign(voices.bassline.custom, { cutoff: 1050, resonance: 7.2, envelopeAmount: 64 });
    voices.lead.custom.cutoff = 4000;
  } else if (variation === 2) {
    kick.pulses = 2;
    cymbal.mute = true;
    hats.pulses = 2;
    bass.pulses = 2;
    ending(bass, 1, 1, 3);
    lead.pulses = 1;
    ending(lead, 1, 1, 11);
    Object.assign(voices.bassline.custom, { cutoff: 330, envelopeAmount: 30 });
    Object.assign(voices.lead.custom, { cutoff: 1600, release: 260 });
    effects.sends.kick.distortion = 32;
    effects.sends.bassline.distortion = 0;
    effects.sends.lead.delay = 52;
  } else if (variation === 3) {
    // Clear the synths and hats before four final sixteenth-note kicks.
    // Shorter kick tails and the quarter-note accent keep the burst shaped.
    kick.series = [
      { id: `${kick.rhythmId}-drive`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
      { id: `${kick.rhythmId}-burst`, steps: 4, pulses: 4, rot: 0, repeats: 1 },
    ];
    voices.kick.decay = 4;
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 2, rot: 5, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 0, 0);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 3, rot: 9, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    cymbal.series[0].repeats = 1;
  }
}
