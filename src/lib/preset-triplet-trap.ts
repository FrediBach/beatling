import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the original kick layers, snare, hats and rim. Added
// voices and modulation sources keep their addresses throughout the song.
const BASS = 6;
const LEAD = 7;
const GHOST_SNARE = 8;
const LOW_TOM = 9;
const OPEN_HAT = 10;
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

const hitsAt = (block: SequencerBlock, step: number) => euclidHit(step, block.steps, block.pulses, block.rot);

/** Curate an owned patch: swung call/response, lift, sparse break, tom return. */
export function refineTripletTrap(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 54, tune: 2 });
  Object.assign(voices.snare, { level: 64, decay: 34 });
  Object.assign(voices.rim, { level: 44, decay: 24 });
  Object.assign(voices.ch, { level: 38, decay: 18 });
  Object.assign(voices.oh, { level: 32, decay: 28 });
  Object.assign(voices.lt, { level: 52, decay: 32, tune: -2 });

  // A short saw bass climbs A–C–E–G across two bars. The lower-register
  // square lead answers in bar two with G and C above the bass phrase.
  Object.assign(voices.bassline, { level: 58, decay: 38 });
  Object.assign(voices.bassline.custom, {
    root: 9, scale: 2, octave: 2, waveform: 0, cutoff: 260,
    resonance: 3, envelopeAmount: 36, filterDecay: 180, accent: 14,
  });
  Object.assign(voices.lead, { level: 32, decay: 38 });
  Object.assign(voices.lead.custom, {
    root: 9, scale: 2, octave: 3, waveform: 1, pulseMix: 12,
    detune: 3, cutoff: 2000, resonance: 1.6, envelopeAmount: 22, attack: 4, release: 360,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.32 }];
  voices.snare.modulations = [{ source: `${SNARE_ACCENT}`, destination: "level", amount: 0.4 }];

  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 1, 2, 3);
  const lead = setLane(patch, LEAD, "lead", 0);
  ending(lead, 1, 2, 3);
  const ghostSnare = setLane(patch, GHOST_SNARE, "snare", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  const openHat = setLane(patch, OPEN_HAT, "oh", 0);
  ending(openHat, 3, 1, 15);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, shape: "ramp" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, shape: "tri" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const rim = patch.blocks.find((block) => block.voice === "rim")!;
  ending(hats, 3, 8, 0);

  // Triplet-synced echoes add a second rhythmic layer to the original
  // swung grid. Keep kick, bass and hats out of the ambience returns.
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 750, damping: 3500, return: 50 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8T", feedback: 28, lowCut: 900, tone: 3000, return: 52 });
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 3, knee: 20, attack: 18, release: 140, makeup: 0, return: 36 });
  effects.sends.kick.compressor = 32;
  effects.sends.snare.compressor = 38;
  effects.sends.snare.reverb = 26;
  effects.sends.rim.reverb = 18;
  effects.sends.rim.delay = 22;
  effects.sends.lt.reverb = 24;
  effects.sends.lead.reverb = 42;
  effects.sends.lead.delay = 60;

  if (variation === 1) {
    bass.pulses = 4;
    ending(bass, 1, 4, 3);
    Object.assign(lead, { pulses: 2, rot: 13 });
    Object.assign(openHat, { pulses: 1, rot: 1, series: [] });
    hats.series = [];
    voices.bassline.custom.cutoff = 380;
    voices.lead.custom.cutoff = 2500;
    voices.lead.level = 36;
  } else if (variation === 2) {
    // Retain the half-time snare and delayed hat strokes while reducing
    // the bass and rim to one note in each two-bar phrase.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 5)) block.mute = true;
    }
    Object.assign(hats, { pulses: 8, rot: 15, series: [] });
    Object.assign(rim, { pulses: 1, rot: 2 });
    ending(rim, 1, 0, 0);
    openHat.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 0, 0);
    voices.bassline.custom.cutoff = 180;
    voices.lead.custom.cutoff = 1500;
    effects.sends.lead.delay = 68;
  } else if (variation === 3) {
    // Clear the last beat of bar two for a soft snare anticipation, rim,
    // low tom and final rest; the original groove returns on the downbeat.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 12)) ending(block, 1, 0, 0);
    }
    ending(bass, 1, 1, 3);
    ending(lead, 1, 1, 3);
    ending(ghostSnare, 1, 1, 11);
    ending(rim, 1, 1, 13);
    ending(lowTom, 1, 1, 14);
    openHat.mute = true;
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
