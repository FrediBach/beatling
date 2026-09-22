import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–4 retain the original 909 kick, hats, clap and cymbal.
const BASS = 5;
const LEAD = 6;
const SNARE = 7;
const SHAKER = 8;
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

function phraseCrash(block: SequencerBlock, silentBars: number) {
  block.series = [{ id: `${block.rhythmId}-rest`, steps: 16, pulses: 0, rot: 0, repeats: silentBars }];
}

/** Curate an owned patch: rave hook, denser lift, filtered kick break, accelerating snare roll. */
export function refineRaveStomp(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 90, decay: 32, tune: 4 });
  Object.assign(voices.clap, { level: 62, decay: 30 });
  Object.assign(voices.ch, { level: 34, decay: 14 });
  Object.assign(voices.oh, { level: 38, decay: 24 });
  Object.assign(voices.cym, { level: 38, decay: 30 });
  Object.assign(voices.snare, { level: 55, decay: 20 });
  Object.assign(voices.shk, { level: 26, decay: 18 });
  for (const id of ["ch", "shk"] as const) {
    voices[id].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.28 }];
  }
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.3 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.18 },
  ];

  // E–G–B–G offbeats leave the floor kicks clear. The high square 101
  // answers on E/B with a detuned companion and short, sharp envelopes.
  Object.assign(voices.bassline, { level: 56, decay: 34 });
  Object.assign(voices.bassline.custom, {
    root: 4, scale: 2, octave: 2, waveform: 0, cutoff: 520,
    resonance: 5.4, envelopeAmount: 54, filterDecay: 125, accent: 24,
  });
  Object.assign(voices.lead, { level: 32, decay: 28 });
  Object.assign(voices.lead.custom, {
    root: 4, scale: 2, octave: 4, waveform: 1, pulseMix: 35, detune: 9,
    cutoff: 2800, resonance: 3.2, envelopeAmount: 36, attack: 3, release: 180,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 4, 2);
  ending(bass, 3, 2, 2);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 1, 7);
  const snare = setLane(patch, SNARE, "snare", 0);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  setLane(patch, BASS_PITCH, "", 1, 2).shape = "tri";
  setLane(patch, LEAD_PITCH, "", 1, 8).shape = "sqr";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 2, shape: "sqr" });

  const [kick, hats, openHat, , cymbal] = patch.blocks;
  phraseCrash(cymbal, 3);
  // A restrained hard-clipped parallel return adds edge to kick/bass.
  // Short room tails and a filtered eighth echo keep the hook articulate.
  Object.assign(effects.distortion, { enabled: true, mode: "hard", drive: 38, trim: -3, tone: 4200, return: 36 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 8, lowCut: 900, damping: 5000, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 18, lowCut: 1200, tone: 4800, return: 42 });
  effects.sends.kick.distortion = 24;
  effects.sends.bassline.distortion = 44;
  effects.sends.clap.reverb = 30;
  effects.sends.snare.reverb = 24;
  effects.sends.lead.reverb = 38;
  effects.sends.lead.delay = 46;

  if (variation === 1) {
    ending(bass, 3, 4, 2);
    lead.pulses = 4;
    ending(lead, 1, 2, 7);
    Object.assign(shaker, { pulses: 8, rot: 15 });
    phraseCrash(cymbal, 1);
    Object.assign(voices.bassline.custom, { cutoff: 880, resonance: 6.6, envelopeAmount: 66 });
    voices.lead.custom.cutoff = 3400;
    voices.lead.level = 35;
  } else if (variation === 2) {
    kick.mute = true;
    openHat.mute = true;
    cymbal.mute = true;
    hats.pulses = 4;
    Object.assign(bass, { pulses: 2, repeats: 1, series: [] });
    Object.assign(lead, { pulses: 1, rot: 5 });
    ending(lead, 1, 1, 3);
    voices.bassline.custom.cutoff = 260;
    voices.bassline.custom.envelopeAmount = 32;
    voices.lead.custom.cutoff = 1700;
    voices.lead.custom.release = 340;
    effects.sends.bassline.distortion = 28;
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Quarter notes become eighths then sixteenths in the second bar.
    // The final beat drops kick, bass and hats to expose the snare roll.
    bass.repeats = 1;
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 2, rot: 6, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 0, 0);
    phraseCrash(cymbal, 1);
    snare.series = [
      { id: `${snare.rhythmId}-quarters`, steps: 8, pulses: 2, rot: 0, repeats: 1 },
      { id: `${snare.rhythmId}-eighths`, steps: 4, pulses: 2, rot: 0, repeats: 1 },
      { id: `${snare.rhythmId}-sixteenths`, steps: 4, pulses: 4, rot: 0, repeats: 1 },
    ];
    for (const block of [kick, hats, openHat]) {
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === hats ? 6 : 3, rot: block === openHat ? 10 : 0, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
