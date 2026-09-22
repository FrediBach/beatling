import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the two kick components, rim, two hat parts and mid tom.
const BASS = 6;
const LEAD = 7;
const OPEN_HAT = 8;
const LOW_TOM = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const TOM_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: bright dub groove, melodic lift, rim break, paired tom answers. */
export function refineDancehall(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 32, tune: -5 });
  Object.assign(voices.rim, { level: 52, decay: 28 });
  Object.assign(voices.ch, { level: 32, decay: 18 });
  Object.assign(voices.oh, { level: 27, decay: 28 });
  // D3 mid-tom and A2 low-tom bodies reinforce the synth's root/fifth.
  Object.assign(voices.mt, { level: 44, decay: 28, tune: 1 });
  Object.assign(voices.lt, { level: 47, decay: 26, tune: 3 });
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.34 }];
  for (const id of ["mt", "lt"] as const) {
    voices[id].modulations = [
      { source: `${TOM_ACCENT}`, destination: "level", amount: 0.28 },
      { source: `${TOM_ACCENT}`, destination: "decay", amount: 0.14 },
    ];
  }

  // D/A square bass leaves the kick and tom attacks clear. Short saw
  // stabs on F-sharp/C give the answering phrase its Mixolydian colour.
  Object.assign(voices.bassline, { level: 56, decay: 40 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 4, octave: 2, waveform: 1, cutoff: 260,
    resonance: 2, envelopeAmount: 24, filterDecay: 240, accent: 10,
  });
  Object.assign(voices.lead, { level: 29, decay: 28 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 4, octave: 3, waveform: 0, pulseMix: 8, detune: 2,
    cutoff: 2100, resonance: 1.8, envelopeAmount: 24, attack: 2, release: 140,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 1, 2, 1);
  const lead = setLane(patch, LEAD, "lead", 2, 7);
  ending(lead, 1, 1, 7);
  const openHat = setLane(patch, OPEN_HAT, "oh", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  setLane(patch, BASS_PITCH, "", 1, 8).shape = "sqr";
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  setLane(patch, TOM_ACCENT, "", 1).shape = "sqr";

  const [, lateKick, , hats, hatPickups, midTom] = patch.blocks;
  ending(midTom, 3, 1, 6);
  // Quarter echoes answer the short rim and lead, while the toms share a
  // small room. Keep kick, bass and hats out of the shared effect tails.
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 14, lowCut: 700, damping: 4000, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/4", feedback: 28, lowCut: 950, tone: 3000, return: 44 });
  effects.sends.rim.reverb = 30;
  effects.sends.rim.delay = 28;
  effects.sends.mt.reverb = 24;
  effects.sends.lt.reverb = 22;
  effects.sends.lead.reverb = 32;
  effects.sends.lead.delay = 50;

  if (variation === 1) {
    Object.assign(bass, { pulses: 4, rot: 15 });
    ending(bass, 1, 4, 1);
    ending(lead, 1, 4, 3);
    ending(openHat, 1, 1, 14);
    Object.assign(midTom, { repeats: 1, series: [] });
    voices.bassline.custom.cutoff = 370;
    voices.lead.custom.cutoff = 2700;
  } else if (variation === 2) {
    lateKick.mute = true;
    midTom.mute = true;
    hatPickups.mute = true;
    Object.assign(hats, { pulses: 4, rot: 2 });
    bass.pulses = 1;
    ending(bass, 1, 1, 1);
    lead.pulses = 1;
    ending(lead, 1, 1, 15);
    voices.bassline.custom.cutoff = 170;
    Object.assign(voices.lead.custom, { cutoff: 1200, release: 320 });
    effects.sends.lead.delay = 60;
  } else if (variation === 3) {
    // Keep every kick and rim backbeat. Clear the later bass/lead notes
    // for mid/low-tom pairs at 21/23 and 29/31; the final pair is softer.
    ending(bass, 1, 1, 1);
    ending(lead, 1, 0, 0);
    ending(midTom, 1, 2, 5);
    ending(lowTom, 1, 2, 7);
    ending(hatPickups, 1, 1, 3);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 8, pulses: 4, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
