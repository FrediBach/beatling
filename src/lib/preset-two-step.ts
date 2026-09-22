import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–7 preserve the three kick components, snare, two hat parts, open hat and rim.
const BASS = 8;
const LEAD = 9;
const SNARE_PICKUP = 10;
const SHAKER = 11;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const BACKBEAT_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: swung bass response, melodic lift, rim break, ghost-snare turnaround. */
export function refineTwoStep(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 85, decay: 32, tune: 0 });
  Object.assign(voices.snare, { level: 59, decay: 28 });
  Object.assign(voices.ch, { level: 33, decay: 16 });
  Object.assign(voices.oh, { level: 34, decay: 24 });
  Object.assign(voices.rim, { level: 40, decay: 20 });
  Object.assign(voices.shk, { level: 23, decay: 16 });
  for (const id of ["ch", "shk"] as const) {
    voices[id].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.32 }];
  }
  voices.snare.modulations = [
    { source: `${BACKBEAT_ACCENT}`, destination: "level", amount: 0.38 },
    { source: `${BACKBEAT_ACCENT}`, destination: "decay", amount: 0.22 },
  ];
  voices.rim.modulations = [{ source: `${BACKBEAT_ACCENT}`, destination: "level", amount: 0.25 }];

  // A rounded D-minor square bass climbs across two bars, leaving every
  // broken kick attack clear. The triangle 101 replies with F/B-flat plucks.
  Object.assign(voices.bassline, { level: 60, decay: 40 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 2, octave: 2, waveform: 1, cutoff: 260,
    resonance: 1.8, envelopeAmount: 22, filterDecay: 220, accent: 10,
  });
  Object.assign(voices.lead, { level: 32, decay: 28 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 2, octave: 4, waveform: 2, pulseMix: 14, detune: 4,
    cutoff: 2100, resonance: 1.5, envelopeAmount: 22, attack: 3, release: 180,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 2);
  Object.assign(bass, { steps: 8, rot: 6 });
  bass.series = [
    { id: `${bass.rhythmId}-pickup`, steps: 8, pulses: 1, rot: 3, repeats: 1 },
    { id: `${bass.rhythmId}-answer`, steps: 16, pulses: 3, rot: 14, repeats: 1 },
  ];
  const lead = setLane(patch, LEAD, "lead", 1, 5);
  ending(lead, 1, 2, 5);
  const snarePickup = setLane(patch, SNARE_PICKUP, "snare", 0);
  ending(snarePickup, 3, 1, 15);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 30, shape: "ramp" });
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, BACKBEAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [, pickupKick, , snare, hats, hatPickups, openHat, rim] = patch.blocks;
  ending(openHat, 3, 0, 0);
  ending(rim, 3, 1, 15);
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 3, attack: 18, release: 110, return: 32 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 12, lowCut: 750, damping: 4200, return: 42 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 22, lowCut: 1000, tone: 3500, return: 40 });
  effects.sends.kick.compressor = 24;
  effects.sends.snare.compressor = 32;
  effects.sends.rim.compressor = 18;
  effects.sends.snare.reverb = 26;
  effects.sends.rim.reverb = 24;
  effects.sends.lead.reverb = 34;
  effects.sends.lead.delay = 46;

  if (variation === 1) {
    bass.series[0].pulses = 2;
    Object.assign(bass.series[1], { pulses: 4, rot: 15 });
    lead.pulses = 2;
    ending(lead, 1, 2, 3);
    Object.assign(shaker, { pulses: 4, rot: 15 });
    Object.assign(openHat, { pulses: 2, rot: 10, repeats: 1, series: [] });
    ending(rim, 3, 2, 7);
    voices.bassline.custom.cutoff = 420;
    voices.lead.custom.cutoff = 2700;
  } else if (variation === 2) {
    // Keep the downbeat and displaced third-beat kick. A rim backbeat
    // and fewer hats expose the bass response without random dropouts.
    pickupKick.mute = true;
    snare.mute = true;
    snarePickup.mute = true;
    Object.assign(rim, { pulses: 2, rot: 12, repeats: 1, series: [] });
    Object.assign(hats, { pulses: 4, rot: 2 });
    hatPickups.mute = true;
    openHat.mute = true;
    bass.pulses = 1;
    bass.series[1].pulses = 1;
    ending(lead, 1, 1, 13);
    voices.bassline.custom.cutoff = 180;
    Object.assign(voices.lead.custom, { cutoff: 1400, release: 340 });
    effects.sends.lead.delay = 56;
  } else if (variation === 3) {
    // The last bass attack is on step 18. A soft snare anticipates the
    // backbeat at 28, and the rim at 31 leads back into the downbeat.
    bass.series[1].pulses = 1;
    ending(lead, 1, 0, 0);
    ending(snarePickup, 1, 1, 11);
    ending(rim, 1, 2, 7);
    ending(openHat, 1, 1, 6);
    ending(hatPickups, 1, 1, 3);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
