import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–7 retain the two kick hits, snare, two rim hits, two hat parts and open hat.
const BASS = 8;
const LEAD = 9;
const SHAKER = 10;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const RIM_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: spacious minor phrase, melodic lift, rim break, trailing snare release. */
export function refineFutureGarage(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 82, decay: 36, tune: -1 });
  Object.assign(voices.snare, { level: 56, decay: 38 });
  Object.assign(voices.rim, { level: 37, decay: 24 });
  Object.assign(voices.ch, { level: 29, decay: 14 });
  Object.assign(voices.oh, { level: 28, decay: 32 });
  Object.assign(voices.shk, { level: 22, decay: 20 });
  for (const id of ["ch", "shk"] as const) {
    voices[id].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.34 }];
  }
  voices.rim.modulations = [
    { source: `${RIM_ACCENT}`, destination: "level", amount: 0.28 },
    { source: `${RIM_ACCENT}`, destination: "decay", amount: 0.14 },
  ];

  // A–C–E bass notes leave space between the broken kicks. The slower
  // triangle 101 unfolds C–D–E over four bars, with a gentle attack and long release.
  Object.assign(voices.bassline, { level: 57, decay: 44 });
  Object.assign(voices.bassline.custom, {
    root: 9, scale: 2, octave: 1, waveform: 1, cutoff: 180,
    resonance: 1.4, envelopeAmount: 14, filterDecay: 340, accent: 8,
  });
  Object.assign(voices.lead, { level: 30, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 9, scale: 2, octave: 3, waveform: 2, pulseMix: 10, detune: 7,
    cutoff: 1500, resonance: 1.2, envelopeAmount: 16, attack: 70, release: 1100,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 2, 3);
  ending(bass, 1, 1, 5);
  const lead = setLane(patch, LEAD, "lead", 1);
  Object.assign(lead, { steps: 32, rot: 27 });
  lead.series = [{ id: `${lead.rhythmId}-answer`, steps: 32, pulses: 2, rot: 25, repeats: 1 }];
  const shaker = setLane(patch, SHAKER, "shk", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 29, shape: "tri" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, shape: "tri" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  setLane(patch, RIM_ACCENT, "", 1).shape = "sqr";

  const [, displacedKick, snare, , lateRim, hats, lateHats, openHat] = patch.blocks;
  ending(openHat, 3, 0, 0);
  // High-passed hall and quarter-note echoes surround the snare and synth
  // without putting the kick, bass or shuffled hats into long shared tails.
  Object.assign(effects.reverb, { enabled: true, space: "hall", preDelay: 28, lowCut: 1000, damping: 3600, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/4", feedback: 32, lowCut: 900, tone: 2600, return: 44 });
  effects.sends.snare.reverb = 28;
  effects.sends.rim.reverb = 24;
  effects.sends.rim.delay = 22;
  effects.sends.lead.reverb = 58;
  effects.sends.lead.delay = 58;

  if (variation === 1) {
    bass.pulses = 4;
    ending(bass, 1, 2, 3);
    Object.assign(lead, { pulses: 2, rot: 29 });
    Object.assign(shaker, { pulses: 4, rot: 15 });
    ending(openHat, 3, 2, 4);
    voices.bassline.custom.cutoff = 260;
    voices.lead.custom.cutoff = 2000;
  } else if (variation === 2) {
    // One downbeat kick and the early rim anchor each bar. Keep only
    // two of the late hats so the single long 101 note can hang over the break.
    displacedKick.mute = true;
    snare.mute = true;
    lateRim.mute = true;
    hats.mute = true;
    Object.assign(lateHats, { pulses: 2, rot: 5 });
    openHat.mute = true;
    bass.pulses = 1;
    lead.series = [];
    voices.bassline.custom.cutoff = 130;
    Object.assign(voices.lead.custom, { cutoff: 1100, release: 1500 });
    effects.sends.lead.reverb = 66;
  } else if (variation === 3) {
    // The second-bar snare is the last new attack. Echoes carry the
    // remaining seven steps into the returning A without a busier drum fill.
    ending(displacedKick, 1, 0, 0);
    ending(lateRim, 1, 1, 7);
    ending(openHat, 1, 0, 0);
    ending(bass, 1, 1, 3);
    Object.assign(lead, { steps: 16, rot: 11 });
    ending(lead, 1, 1, 7);
    for (const block of [hats, lateHats]) {
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 8, pulses: 2, rot: block === hats ? 0 : 1, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
