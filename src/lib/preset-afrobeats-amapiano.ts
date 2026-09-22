import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–7 retain three kick components, rim, two low-tom parts, shaker and hats.
const BASS = 8;
const LEAD = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const TOM_PITCH = 14;
const SHAKER_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: octave tom groove, melodic lift, tom break, rising tom ending. */
export function refineAfrobeatsAmapiano(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 78, decay: 18, tune: -1 });
  Object.assign(voices.rim, { level: 49, decay: 26 });
  Object.assign(voices.lt, { level: 60, decay: 26, tune: -6 });
  Object.assign(voices.shk, { level: 30, decay: 18 });
  Object.assign(voices.ch, { level: 28, decay: 16 });
  // Bipolar tuning adds ±6 semitones to the -6 base: the 808 tom body
  // alternates near F-sharp1/F-sharp2. Higher replies are lighter and shorter.
  voices.lt.modulations = [
    { source: `${TOM_PITCH}`, destination: "tune", amount: 0.5 },
    { source: `${TOM_PITCH}`, destination: "level", amount: -0.18 },
    { source: `${TOM_PITCH}`, destination: "decay", amount: -0.1 },
  ];
  voices.shk.modulations = [{ source: `${SHAKER_ACCENT}`, destination: "level", amount: 0.3 }];

  // Quiet, short F-sharp/C-sharp bass notes fit around the pitched toms.
  // A triangle 101 supplies A/C-sharp above the percussion-led arrangement.
  Object.assign(voices.bassline, { level: 44, decay: 30 });
  Object.assign(voices.bassline.custom, {
    root: 6, scale: 2, octave: 2, waveform: 1, cutoff: 180,
    resonance: 1.4, envelopeAmount: 16, filterDecay: 140, accent: 8,
  });
  Object.assign(voices.lead, { level: 30, decay: 32 });
  Object.assign(voices.lead.custom, {
    root: 6, scale: 2, octave: 3, waveform: 2, pulseMix: 6, detune: 2,
    cutoff: 1600, resonance: 1.3, envelopeAmount: 18, attack: 8, release: 280,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 2, 1);
  ending(bass, 1, 2, 7);
  const lead = setLane(patch, LEAD, "lead", 1, 5);
  ending(lead, 1, 1, 9);
  setLane(patch, BASS_PITCH, "", 1, 8).shape = "sqr";
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "tri";
  const tomPitch = setLane(patch, TOM_PITCH, "", 1);
  Object.assign(tomPitch, { steps: 8, rot: 4, shape: "sqr" });
  Object.assign(setLane(patch, SHAKER_ACCENT, "", 1), { steps: 2, shape: "sqr" });

  const [, pickupKick, offbeatKick, , lowTom, highTom, shaker, hats] = patch.blocks;
  ending(highTom, 3, 1, 13);
  ending(shaker, 3, 8, 0);
  // Add a little harmonic edge to the tom, reserving ambience for rim
  // and melody. Keep kick, bass, shaker and hats clear of effect tails.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 20, tone: 1800, return: 36 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 12, lowCut: 800, damping: 4000, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 22, lowCut: 1100, tone: 3200, return: 40 });
  effects.sends.lt.distortion = 34;
  effects.sends.rim.reverb = 26;
  effects.sends.lead.reverb = 42;
  effects.sends.lead.delay = 48;

  if (variation === 1) {
    lead.pulses = 2;
    ending(lead, 1, 2, 1);
    for (const block of [highTom, shaker]) Object.assign(block, { repeats: 1, series: [] });
    voices.bassline.custom.cutoff = 250;
    voices.lead.custom.cutoff = 2100;
  } else if (variation === 2) {
    // Downbeat kicks and the original pitched toms carry the break.
    pickupKick.mute = true;
    offbeatKick.mute = true;
    hats.mute = true;
    Object.assign(shaker, { pulses: 4, rot: 0, repeats: 1, series: [] });
    Object.assign(highTom, { repeats: 1, series: [] });
    bass.pulses = 1;
    ending(bass, 1, 1, 7);
    lead.pulses = 0;
    voices.bassline.custom.cutoff = 140;
    Object.assign(voices.lead.custom, { cutoff: 1100, release: 420 });
    effects.sends.lead.delay = 60;
  } else if (variation === 3) {
    // Drop the last kick and clear the synths/percussion for four tom
    // hits at 28–31: two low roots followed by two softer octave replies.
    ending(offbeatKick, 1, 1, 6);
    ending(bass, 1, 1, 1);
    ending(lead, 1, 0, 0);
    Object.assign(tomPitch, { steps: 4, rot: 2 });
    for (const [block, offset, finalRotation] of [[lowTom, 2, 0], [highTom, 5, 1]] as const) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: 1, rot: 12 - offset, repeats: 1 },
        { id: `${block.rhythmId}-ending`, steps: 4, pulses: 2, rot: finalRotation, repeats: 1 },
      ];
    }
    for (const block of [shaker, hats]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === shaker ? 9 : 3, rot: block === shaker ? 3 : 10, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
