import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–7 retain the layered kicks, snare, cymbal, open hat and rims.
const BASS = 8;
const LEAD = 9;
const CLOSED_HAT = 10;
const SNARE_PICKUP = 11;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const CYMBAL_ACCENT = 14;
const NOTE_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

function releaseLastBeat(block: SequencerBlock, repeats: number, pulses: number, rot: number) {
  block.repeats = repeats;
  block.series = [
    { id: `${block.rhythmId}-short`, steps: 12, pulses, rot, repeats: 1 },
    { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
  ];
}

/** Curate an owned patch: minor roll, brighter lift, sparse break, late-kick turnaround. */
export function refineRollingTechno(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 38, tune: 0 });
  Object.assign(voices.snare, { level: 62, decay: 28 });
  Object.assign(voices.cym, { level: 20, decay: 10 });
  Object.assign(voices.oh, { level: 36, decay: 28 });
  Object.assign(voices.rim, { level: 42, decay: 22 });
  Object.assign(voices.ch, { level: 26, decay: 14 });
  voices.cym.modulations = [{ source: `${CYMBAL_ACCENT}`, destination: "level", amount: 0.36 }];
  voices.snare.modulations = [
    { source: `${NOTE_ACCENT}`, destination: "level", amount: 0.28 },
    { source: `${NOTE_ACCENT}`, destination: "decay", amount: 0.2 },
  ];

  // Short D–F–A–F saw notes roll between the kicks. Root and fifth get
  // more weight and length; the 101 answers with a higher C then D.
  Object.assign(voices.bassline, { level: 53, decay: 30 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 2, octave: 2, waveform: 0, cutoff: 500,
    resonance: 4.6, envelopeAmount: 46, filterDecay: 105, accent: 20,
  });
  Object.assign(voices.lead, { level: 31, decay: 32 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 2, octave: 3, waveform: 1, pulseMix: 12, detune: 3,
    cutoff: 1800, resonance: 2.6, envelopeAmount: 32, attack: 3, release: 220,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 },
    { source: `${NOTE_ACCENT}`, destination: "level", amount: 0.22 },
    { source: `${NOTE_ACCENT}`, destination: "decay", amount: 0.18 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 10 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 8, 1);
  releaseLastBeat(bass, 3, 6, 1);
  const lead = setLane(patch, LEAD, "lead", 0);
  ending(lead, 1, 2, 6);
  const closedHat = setLane(patch, CLOSED_HAT, "ch", 0);
  const snarePickup = setLane(patch, SNARE_PICKUP, "snare", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 8, rot: 7, shape: "tri" });
  setLane(patch, LEAD_PITCH, "", 1).shape = "sqr";
  Object.assign(setLane(patch, CYMBAL_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, NOTE_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const cymbal = patch.blocks.find((block) => block.voice === "cym")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 20, tone: 3500, return: 38 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 6, lowCut: 800, damping: 3900, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8T", feedback: 24, lowCut: 1100, tone: 3600, return: 46 });
  effects.sends.bassline.distortion = 30;
  effects.sends.snare.reverb = 30;
  effects.sends.rim.reverb = 24;
  effects.sends.rim.delay = 28;
  effects.sends.lead.reverb = 30;
  effects.sends.lead.delay = 56;

  if (variation === 1) {
    // Complete the fourth-bar bass roll and add quiet offbeat hats.
    ending(bass, 3, 8, 1);
    Object.assign(lead, { pulses: 2, rot: 10 });
    Object.assign(closedHat, { pulses: 4, rot: 14 });
    Object.assign(voices.bassline.custom, { cutoff: 760, resonance: 5.6, envelopeAmount: 58 });
    voices.lead.custom.cutoff = 2400;
    voices.lead.level = 34;
  } else if (variation === 2) {
    // Keep only the kicks on beats one and three, with quarter-note
    // cymbals and a slower root/fifth bass beneath a sustained 101 reply.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && !euclidHit(0, block.steps, block.pulses, block.rot)) block.mute = true;
    }
    cymbal.pulses = 4;
    openHat.mute = true;
    Object.assign(bass, { pulses: 4, repeats: 1, series: [] });
    ending(lead, 1, 1, 14);
    voices.bassline.decay = 42;
    Object.assign(voices.bassline.custom, { cutoff: 220, resonance: 3.4, envelopeAmount: 30, filterDecay: 210 });
    voices.lead.custom.cutoff = 1200;
    voices.lead.custom.release = 600;
    effects.sends.lead.reverb = 56;
    effects.sends.lead.delay = 62;
  } else if (variation === 3) {
    // The original rim at 29 and kick at 30 lead into a softer snare at
    // 31. Stop new bass/cymbal notes for that final beat of the second bar.
    releaseLastBeat(bass, 1, 6, 1);
    Object.assign(lead, { pulses: 1, rot: 10 });
    ending(lead, 1, 0, 0);
    ending(snarePickup, 1, 1, 15);
    releaseLastBeat(cymbal, 1, 9, 0);
  }
}
