import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–6 preserve the two kick hits, rim, cowbell, mid/low toms and shaker.
const BASS = 7;
const LEAD = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const SHAKER_ACCENT = 14;
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

/** Curate an owned patch: major-key soul groove, shaker lift, low-tom break, paired tom turnaround. */
export function refineSlow808Soul(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 82, decay: 48, tune: -4 });
  Object.assign(voices.rim, { level: 49, decay: 30 });
  Object.assign(voices.cow, { level: 29, decay: 24 });
  // The tom bodies sit close to B-flat3 and E-flat3, above the bass register.
  Object.assign(voices.mt, { level: 42, decay: 30, tune: 9 });
  Object.assign(voices.lt, { level: 46, decay: 34, tune: 9 });
  Object.assign(voices.shk, { level: 32, decay: 24 });
  voices.shk.modulations = [{ source: `${SHAKER_ACCENT}`, destination: "level", amount: 0.26 }];
  for (const id of ["mt", "lt", "cow"] as const) {
    voices[id].modulations = [
      { source: `${TOM_ACCENT}`, destination: "level", amount: 0.26 },
      { source: `${TOM_ACCENT}`, destination: "decay", amount: 0.12 },
    ];
  }

  // E-flat–G–B-flat–G square bass fits between the kick and tom attacks.
  // A softened saw 101 replies on G/D, adding a major seventh above the root.
  Object.assign(voices.bassline, { level: 55, decay: 46 });
  Object.assign(voices.bassline.custom, {
    root: 3, scale: 1, octave: 2, waveform: 1, cutoff: 220,
    resonance: 1.5, envelopeAmount: 18, filterDecay: 260, accent: 8,
  });
  Object.assign(voices.lead, { level: 31, decay: 42 });
  Object.assign(voices.lead.custom, {
    root: 3, scale: 1, octave: 3, waveform: 0, pulseMix: 8, detune: 3,
    cutoff: 1250, resonance: 1.4, envelopeAmount: 20, attack: 14, release: 440,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 2, 3);
  ending(bass, 1, 2, 1);
  const lead = setLane(patch, LEAD, "lead", 1, 7);
  ending(lead, 1, 2, 7);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 29, shape: "tri" });
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, SHAKER_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  const tomAccent = setLane(patch, TOM_ACCENT, "", 1);
  tomAccent.shape = "sqr";

  const [, lateKick, , cowbell, midTom, lowTom, shaker] = patch.blocks;
  ending(cowbell, 1, 1, 2);
  ending(midTom, 3, 1, 6);
  ending(lowTom, 3, 1, 15);
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 12, lowCut: 550, damping: 4500, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 16, lowCut: 1000, tone: 3200, return: 42 });
  effects.sends.rim.reverb = 28;
  effects.sends.mt.reverb = 30;
  effects.sends.lt.reverb = 26;
  effects.sends.cow.reverb = 12;
  effects.sends.lead.reverb = 35;
  effects.sends.lead.delay = 44;

  if (variation === 1) {
    Object.assign(bass, { pulses: 4, rot: 15 });
    ending(bass, 1, 2, 3);
    lead.pulses = 2;
    ending(lead, 1, 2, 3);
    for (const block of [cowbell, midTom, lowTom]) Object.assign(block, { repeats: 1, series: [] });
    shaker.pulses = 16;
    ending(shaker, 3, 8, 0);
    voices.bassline.custom.cutoff = 310;
    voices.lead.custom.cutoff = 1750;
  } else if (variation === 2) {
    lateKick.mute = true;
    cowbell.mute = true;
    midTom.mute = true;
    Object.assign(lowTom, { pulses: 1, rot: 1, repeats: 1, series: [] });
    Object.assign(shaker, { pulses: 4, rot: 2 });
    bass.pulses = 1;
    ending(bass, 1, 1, 9);
    ending(lead, 1, 1, 11);
    voices.bassline.custom.cutoff = 160;
    Object.assign(voices.lead.custom, { cutoff: 950, release: 650 });
    effects.sends.lead.delay = 52;
  } else if (variation === 3) {
    // Clear the late kick and shaker for two mid/low-tom replies at
    // 26/27 and 30/31. The last pair is softer and shorter than the first.
    ending(lateKick, 1, 0, 0);
    ending(bass, 1, 1, 3);
    ending(lead, 1, 0, 0);
    Object.assign(tomAccent, { steps: 8, rot: 6 });
    for (const block of [midTom, lowTom]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
        { id: `${block.rhythmId}-reply`, steps: 8, pulses: 2, rot: block === midTom ? 6 : 5, repeats: 1 },
      ];
    }
    shaker.series = [
      { id: `${shaker.rhythmId}-short`, steps: 8, pulses: 4, rot: 0, repeats: 1 },
      { id: `${shaker.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
