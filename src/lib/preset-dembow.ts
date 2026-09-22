import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–3 retain the six-hit kick, two snare components and eighth-note hats.
const BASS = 4;
const LEAD = 5;
const RIM = 6;
const SHAKER = 7;
const LOW_TOM = 8;
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

/** Curate an owned patch: interlocking bass, shaker lift, syncopated break, tom/rim reply. */
export function refineDembow(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 20, tune: 2 });
  Object.assign(voices.snare, { level: 60, decay: 26 });
  Object.assign(voices.ch, { level: 33, decay: 16 });
  Object.assign(voices.rim, { level: 39, decay: 20 });
  Object.assign(voices.shk, { level: 24, decay: 18 });
  Object.assign(voices.lt, { level: 46, decay: 22, tune: 3 });
  for (const id of ["ch", "shk"] as const) {
    voices[id].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.26 }];
  }
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.28 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.16 },
  ];

  // Short A/E square bass notes occupy the gaps between kick attacks.
  // The square 101 calls C–E–G in bar one, leaving bar two to the rhythm.
  Object.assign(voices.bassline, { level: 55, decay: 36 });
  Object.assign(voices.bassline.custom, {
    root: 9, scale: 2, octave: 2, waveform: 1, cutoff: 330,
    resonance: 2.5, envelopeAmount: 34, filterDecay: 150, accent: 14,
  });
  Object.assign(voices.lead, { level: 30, decay: 26 });
  Object.assign(voices.lead.custom, {
    root: 9, scale: 2, octave: 3, waveform: 1, pulseMix: 16, detune: 4,
    cutoff: 2400, resonance: 2.4, envelopeAmount: 28, attack: 2, release: 140,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 1, 2, 2);
  const lead = setLane(patch, LEAD, "lead", 1);
  Object.assign(lead, { steps: 8, rot: 3 });
  lead.series = [
    { id: `${lead.rhythmId}-call`, steps: 8, pulses: 2, rot: 1, repeats: 1 },
    { id: `${lead.rhythmId}-space`, steps: 16, pulses: 0, rot: 0, repeats: 1 },
  ];
  const rim = setLane(patch, RIM, "rim", 0);
  ending(rim, 3, 1, 13);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  setLane(patch, BASS_PITCH, "", 1, 8).shape = "sqr";
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [kick, , snarePickups, hats] = patch.blocks;
  // Parallel compression supports the kick/snare conversation. Small room
  // tails and a lead-only eighth echo keep the syncopation clearly defined.
  Object.assign(effects.compressor, { enabled: true, threshold: -20, ratio: 4, attack: 16, release: 140, return: 28 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 8, lowCut: 700, damping: 4400, return: 42 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 18, lowCut: 1100, tone: 3400, return: 40 });
  effects.sends.kick.compressor = 26;
  effects.sends.snare.compressor = 30;
  effects.sends.lt.compressor = 18;
  effects.sends.snare.reverb = 30;
  effects.sends.rim.reverb = 18;
  effects.sends.lt.reverb = 20;
  effects.sends.lead.reverb = 28;
  effects.sends.lead.delay = 42;

  if (variation === 1) {
    ending(bass, 1, 4, 1);
    Object.assign(lead.series[1], { pulses: 2, rot: 13 });
    Object.assign(shaker, { pulses: 8, rot: 15 });
    ending(rim, 3, 2, 5);
    voices.bassline.custom.cutoff = 460;
    voices.lead.custom.cutoff = 3000;
  } else if (variation === 2) {
    // Retain the kicks at 3/11 and the following backbeats at 4/12.
    // Removing the late snare pickups opens space without losing syncopation.
    Object.assign(kick, { pulses: 2, rot: 13 });
    snarePickups.mute = true;
    Object.assign(hats, { pulses: 4, rot: 2 });
    rim.mute = true;
    bass.pulses = 2;
    ending(bass, 1, 1, 2);
    lead.series[0].pulses = 0;
    Object.assign(lead.series[1], { pulses: 1, rot: 13 });
    voices.bassline.custom.cutoff = 220;
    Object.assign(voices.lead.custom, { cutoff: 1300, release: 260 });
    effects.sends.lead.delay = 52;
  } else if (variation === 3) {
    // Preserve every original kick and snare. A low tom at 25 and rim at
    // 29 fill the gaps, with bass and hats clearing space for the last beat.
    ending(bass, 1, 1, 2);
    Object.assign(lead.series[0], { pulses: 1, rot: 5 });
    ending(lowTom, 1, 1, 9);
    ending(rim, 1, 1, 13);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
