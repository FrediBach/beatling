import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Keep the original kick, closed hat, open hat and rim in slots 0–3.
const BASS = 4;
const LEAD = 5;
const SHAKER = 6;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const DRUM_ACCENT = 14;
const BASS_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: shifting acid ostinato, lift, suspended break, rim ending. */
export function refineHypnoticAcid(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 40, tune: 0 });
  Object.assign(voices.ch, { level: 35, decay: 18 });
  Object.assign(voices.oh, { level: 37, decay: 32 });
  Object.assign(voices.rim, { level: 43, decay: 24 });
  Object.assign(voices.shk, { level: 26, decay: 20 });

  // F-sharp and its fifth carry the motif. A soft triangle 101 adds the
  // minor third only once in the four-bar groove.
  Object.assign(voices.bassline, { level: 54, decay: 36 });
  Object.assign(voices.bassline.custom, {
    root: 6, scale: 2, octave: 2, waveform: 0, cutoff: 300,
    resonance: 9, envelopeAmount: 54, filterDecay: 150, accent: 28,
  });
  Object.assign(voices.lead, { level: 30, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 6, scale: 2, octave: 3, waveform: 2, pulseMix: 10, detune: 4,
    cutoff: 1400, resonance: 1.5, envelopeAmount: 16, attack: 18, release: 540,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 },
    { source: `${BASS_ACCENT}`, destination: "level", amount: 0.24 },
    { source: `${BASS_ACCENT}`, destination: "decay", amount: 0.24 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 0.25 }];
  for (const id of ["ch", "rim", "shk"] as const) {
    voices[id].modulations = [{ source: `${DRUM_ACCENT}`, destination: "level", amount: id === "rim" ? 0.24 : 0.32 }];
  }

  // Five twelve-step cycles drift across the bar lines, followed by a
  // four-step breath. The complete phrase returns after exactly four bars.
  const bass = setLane(patch, BASS, "bassline", 5);
  Object.assign(bass, { steps: 12, rot: 11, repeats: 5 });
  bass.series = [{ id: `${bass.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 }];
  const lead = setLane(patch, LEAD, "lead", 1);
  Object.assign(lead, { steps: 32, rot: 6 });
  lead.series = [{ id: `${lead.rhythmId}-rest`, steps: 32, pulses: 0, rot: 0, repeats: 1 }];
  const shaker = setLane(patch, SHAKER, "shk", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 4, rot: 2, shape: "sqr" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  Object.assign(setLane(patch, DRUM_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, BASS_ACCENT, "", 1), { steps: 4, shape: "tri" });

  const kick = patch.blocks[0];
  const hats = patch.blocks[1];
  const openHat = patch.blocks[2];
  const rim = patch.blocks[3];
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 24, tone: 3700, return: 40 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 30, lowCut: 800, tone: 2900, return: 50 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 18, lowCut: 900, damping: 3300, return: 44 });
  effects.sends.bassline.distortion = 32;
  effects.sends.bassline.delay = 28;
  effects.sends.rim.delay = 40;
  effects.sends.rim.reverb = 16;
  effects.sends.lead.delay = 56;
  effects.sends.lead.reverb = 56;

  if (variation === 1) {
    bass.repeats = 4;
    bass.series = [
      { id: `${bass.rhythmId}-lift`, steps: 12, pulses: 7, rot: 11, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    lead.pulses = 2;
    lead.series[0].pulses = 1;
    lead.series[0].rot = 6;
    Object.assign(shaker, { pulses: 8, rot: 15 });
    ending(shaker, 3, 12, 1);
    Object.assign(voices.bassline.custom, { cutoff: 620, resonance: 10.4, envelopeAmount: 68, filterDecay: 135 });
  } else if (variation === 2) {
    kick.mute = true;
    hats.pulses = 4;
    openHat.mute = true;
    Object.assign(bass, { pulses: 3, repeats: 2 });
    bass.series = [{ id: `${bass.rhythmId}-answer`, steps: 8, pulses: 1, rot: 7, repeats: 1 }];
    Object.assign(lead, { steps: 16, pulses: 0, rot: 0 });
    ending(lead, 1, 1, 10);
    voices.bassline.decay = 50;
    Object.assign(voices.bassline.custom, { cutoff: 180, resonance: 7, envelopeAmount: 35, filterDecay: 300 });
    effects.sends.bassline.delay = 36;
    effects.sends.lead.reverb = 64;
  } else if (variation === 3) {
    // Two cycles then a half-bar bass rest let the 101 and rim answer.
    bass.repeats = 2;
    bass.series[0].steps = 8;
    Object.assign(lead, { steps: 16, pulses: 0, rot: 0 });
    ending(lead, 1, 1, 13);
    ending(openHat, 1, 0, 0);
    rim.series = [
      { id: `${rim.rhythmId}-short`, steps: 12, pulses: 1, rot: 9, repeats: 1 },
      { id: `${rim.rhythmId}-pickup`, steps: 4, pulses: 2, rot: 3, repeats: 1 },
    ];
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
