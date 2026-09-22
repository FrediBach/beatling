import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the original kick, clap, low/mid/high toms and hats.
const BASS = 6;
const LEAD = 7;
const SHAKER = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const TOM_ACCENT = 14;
const HAT_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: tuned tom groove, percussion lift, low-tom break, descending roll. */
export function refineTomDrivenTechno(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 36, tune: -1 });
  Object.assign(voices.clap, { level: 58, decay: 28 });
  Object.assign(voices.ch, { level: 30, decay: 16 });
  Object.assign(voices.shk, { level: 24, decay: 18 });
  // The 909 bodies settle near F-sharp2, C-sharp3 and A3. Their second
  // hits are lighter and shorter, leaving the interlocking rhythm clear.
  Object.assign(voices.lt, { level: 62, decay: 28, tune: 0 });
  Object.assign(voices.mt, { level: 58, decay: 28, tune: 0 });
  Object.assign(voices.ht, { level: 54, decay: 26, tune: 2 });
  for (const id of ["lt", "mt", "ht"] as const) {
    voices[id].modulations = [
      { source: `${TOM_ACCENT}`, destination: "level", amount: 0.25 },
      { source: `${TOM_ACCENT}`, destination: "decay", amount: 0.14 },
    ];
  }
  for (const id of ["ch", "shk"] as const) {
    voices[id].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.28 }];
  }

  // A low root/fifth square bass sits beneath the tom bodies. The sparse
  // triangle 101 adds the minor third and root above the percussion.
  Object.assign(voices.bassline, { level: 50, decay: 34 });
  Object.assign(voices.bassline.custom, {
    root: 6, scale: 2, octave: 1, waveform: 1, cutoff: 200,
    resonance: 2.2, envelopeAmount: 24, filterDecay: 150, accent: 10,
  });
  Object.assign(voices.lead, { level: 29, decay: 36 });
  Object.assign(voices.lead.custom, {
    root: 6, scale: 2, octave: 3, waveform: 2, pulseMix: 8, detune: 3,
    cutoff: 1500, resonance: 1.4, envelopeAmount: 18, attack: 10, release: 300,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 0.25 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 3, 2, 1);
  const lead = setLane(patch, LEAD, "lead", 1, 7);
  ending(lead, 1, 1, 15);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  setLane(patch, LEAD_PITCH, "", 1).shape = "sqr";
  const tomAccent = setLane(patch, TOM_ACCENT, "", 1);
  tomAccent.shape = "sqr";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [kick, clap, lowTom, midTom, highTom, hats] = patch.blocks;
  // Parallel compression and a small room bring the toms forward.
  // The kick and bass stay dry; only the 101 feeds the dotted echo.
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 4, knee: 18, attack: 16, release: 130, makeup: 0, return: 42 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 650, damping: 4400, return: 48 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 18, lowCut: 1100, tone: 3200, return: 44 });
  effects.sends.lt.compressor = 36;
  effects.sends.mt.compressor = 40;
  effects.sends.ht.compressor = 42;
  effects.sends.lt.reverb = 30;
  effects.sends.mt.reverb = 34;
  effects.sends.ht.reverb = 38;
  effects.sends.clap.reverb = 28;
  effects.sends.lead.reverb = 40;
  effects.sends.lead.delay = 54;

  if (variation === 1) {
    ending(bass, 3, 4, 1);
    lead.pulses = 2;
    ending(lead, 1, 2, 7);
    Object.assign(shaker, { pulses: 8, rot: 15 });
    ending(highTom, 3, 4, 3);
    voices.bassline.custom.cutoff = 330;
    voices.lead.custom.cutoff = 1900;
  } else if (variation === 2) {
    // Low and mid toms keep the groove moving through the sparse break.
    kick.pulses = 2;
    clap.mute = true;
    highTom.mute = true;
    hats.pulses = 4;
    Object.assign(bass, { pulses: 2, repeats: 1, series: [] });
    lead.pulses = 0;
    voices.bassline.decay = 42;
    voices.bassline.custom.cutoff = 140;
    voices.bassline.custom.filterDecay = 200;
    effects.sends.lead.reverb = 64;
  } else if (variation === 3) {
    // The second bar thins out before high/mid/low/low on 28–31.
    // Alternating accents make the last low-tom tap a soft release.
    tomAccent.steps = 2;
    bass.repeats = 1;
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 2, rot: 7, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 0, 0);
    for (const [block, offset, finalOffset] of [[highTom, 3, 0], [midTom, 6, 1]] as const) {
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: 1, rot: 12 - offset, repeats: 1 },
        { id: `${block.rhythmId}-roll`, steps: 4, pulses: 1, rot: (4 - finalOffset) % 4, repeats: 1 },
      ];
    }
    lowTom.series = [
      { id: `${lowTom.rhythmId}-short`, steps: 12, pulses: 1, rot: 10, repeats: 1 },
      { id: `${lowTom.rhythmId}-wait`, steps: 2, pulses: 0, rot: 0, repeats: 1 },
      { id: `${lowTom.rhythmId}-double`, steps: 2, pulses: 2, rot: 0, repeats: 1 },
    ];
    for (const block of [kick, hats]) {
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === kick ? 3 : 6, rot: 0, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
