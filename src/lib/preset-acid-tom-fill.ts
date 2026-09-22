import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Keep the original mute gates (0–1) and routed drums (2–9) at their
// existing addresses. The remaining six slots carry synths and modulation.
const BASS = 10;
const LEAD = 11;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const DRUM_ACCENT = 14;
const BASS_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function beforeToms(block: SequencerBlock, pulses: number, offset: number) {
  block.series = [
    { id: `${block.rhythmId}-answer`, steps: 8, pulses, rot: (8 - offset) % 8, repeats: 1 },
    { id: `${block.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
  ];
}

/** Curate an owned patch: acid call, tom response, lift, break and closing roll. */
export function refineAcidTomFill(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 42, tune: 0 });
  Object.assign(voices.clap, { level: 60, decay: 30 });
  Object.assign(voices.ch, { level: 31, decay: 15 });
  // Approximately G3–D3–G2; the last low-tom hit is quieter and shorter.
  Object.assign(voices.ht, { level: 60, decay: 32, tune: 0 });
  Object.assign(voices.mt, { level: 62, decay: 28, tune: 1 });
  Object.assign(voices.lt, { level: 64, decay: 22, tune: 1 });
  voices.ch.modulations = [{ source: `${DRUM_ACCENT}`, destination: "level", amount: 0.3 }];
  for (const id of ["mt", "lt"] as const) {
    voices[id].modulations = [
      { source: `${DRUM_ACCENT}`, destination: "level", amount: 0.22 },
      { source: `${DRUM_ACCENT}`, destination: "decay", amount: 0.16 },
    ];
  }

  Object.assign(voices.bassline, { level: 53, decay: 35 });
  Object.assign(voices.bassline.custom, {
    root: 7, scale: 2, octave: 2, waveform: 1, cutoff: 360,
    resonance: 8.2, envelopeAmount: 62, filterDecay: 130, accent: 30,
  });
  Object.assign(voices.lead, { level: 29, decay: 30 });
  Object.assign(voices.lead.custom, {
    root: 7, scale: 2, octave: 3, waveform: 1, pulseMix: 22, detune: 2,
    cutoff: 1900, resonance: 1.8, envelopeAmount: 24, attack: 4, release: 180,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 1 },
    { source: `${BASS_ACCENT}`, destination: "level", amount: 0.24 },
    { source: `${BASS_ACCENT}`, destination: "decay", amount: 0.18 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 6, 1);
  beforeToms(bass, 3, 1);
  const lead = setLane(patch, LEAD, "lead", 1, 6);
  beforeToms(lead, 1, 2);
  setLane(patch, BASS_PITCH, "", 1).shape = "ramp";
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  Object.assign(setLane(patch, DRUM_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, BASS_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  // Short room tails give the descending toms space; only the 101 feeds
  // the filtered eighth-note echo, leaving the bass phrase's rest clear.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 30, tone: 4000, return: 40 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 8, lowCut: 600, damping: 4200, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 16, lowCut: 1000, tone: 3200, return: 40 });
  effects.sends.bassline.distortion = 36;
  effects.sends.clap.reverb = 28;
  effects.sends.ht.reverb = 34;
  effects.sends.mt.reverb = 30;
  effects.sends.lt.reverb = 24;
  effects.sends.lead.reverb = 38;
  effects.sends.lead.delay = 42;

  if (variation === 1) {
    bass.pulses = 8;
    beforeToms(bass, 4, 1);
    lead.pulses = 2;
    Object.assign(voices.bassline.custom, { cutoff: 680, resonance: 9.6, envelopeAmount: 74, filterDecay: 115 });
    voices.lead.level = 32;
  } else if (variation === 2) {
    // Halve the floor pulse and hats; a smaller tom answer still marks
    // the two-bar boundary while the acid filter closes down.
    patch.blocks[2].pulses = 2;
    patch.blocks[4].pulses = 8;
    patch.blocks[6].mute = true;
    bass.pulses = 2;
    beforeToms(bass, 1, 1);
    beforeToms(lead, 0, 0);
    Object.assign(voices.bassline.custom, { cutoff: 180, resonance: 6.8, envelopeAmount: 40, filterDecay: 210 });
    voices.ht.level = 48;
    voices.mt.level = 50;
    voices.lt.level = 52;
    effects.sends.lead.reverb = 50;
  } else if (variation === 3) {
    // Finish the synth call early, then add a softer mid-tom sixteenth
    // between the original mid-tom and low-tom double hit.
    beforeToms(bass, 1, 1);
    lead.rot = 2;
    beforeToms(lead, 0, 0);
    const midTom = patch.blocks[7];
    Object.assign(midTom, { steps: 28, pulses: 0, rot: 0 });
    midTom.series = [
      { id: `${midTom.rhythmId}-roll`, steps: 2, pulses: 2, rot: 0, repeats: 1 },
      { id: `${midTom.rhythmId}-rest`, steps: 2, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
