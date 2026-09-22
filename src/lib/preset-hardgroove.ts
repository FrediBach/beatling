import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the kick, cymbal, two rim components, clap and open hat.
const BASS = 6;
const LEAD = 7;
const LOW_TOM = 8;
const COWBELL = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const CYMBAL_ACCENT = 14;
const PERCUSSION_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: percussion groove, cowbell lift, rim/tom break, trading ending. */
export function refineHardgroove(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 88, decay: 32, tune: 4 });
  Object.assign(voices.cym, { level: 20, decay: 8 });
  Object.assign(voices.rim, { level: 50, decay: 24 });
  Object.assign(voices.clap, { level: 60, decay: 30 });
  Object.assign(voices.oh, { level: 35, decay: 26 });
  Object.assign(voices.lt, { level: 51, decay: 22, tune: -1 });
  Object.assign(voices.cow, { level: 42, decay: 22 });
  voices.cym.modulations = [{ source: `${CYMBAL_ACCENT}`, destination: "level", amount: 0.34 }];
  voices.rim.modulations = [
    { source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.32 },
    { source: `${PERCUSSION_ACCENT}`, destination: "decay", amount: 0.14 },
  ];
  voices.lt.modulations = [
    { source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.24 },
    { source: `${PERCUSSION_ACCENT}`, destination: "decay", amount: 0.16 },
  ];
  voices.cow.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.2 }];

  // F-minor pentatonic bass fills the gaps around the low-tom answers.
  // Short A-flat/C square stabs reinforce the rim's first-bar call.
  Object.assign(voices.bassline, { level: 55, decay: 32 });
  Object.assign(voices.bassline.custom, {
    root: 5, scale: 5, octave: 2, waveform: 0, cutoff: 380,
    resonance: 3.8, envelopeAmount: 42, filterDecay: 115, accent: 18,
  });
  Object.assign(voices.lead, { level: 28, decay: 28 });
  Object.assign(voices.lead.custom, {
    root: 5, scale: 5, octave: 3, waveform: 1, pulseMix: 10, detune: 2,
    cutoff: 2200, resonance: 2, envelopeAmount: 30, attack: 3, release: 170,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 1, 2, 5);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 0, 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  ending(lowTom, 1, 2, 1);
  const cowbell = setLane(patch, COWBELL, "cow", 0);
  setLane(patch, BASS_PITCH, "", 1, 1).shape = "ramp";
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  Object.assign(setLane(patch, CYMBAL_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  const percussionAccent = setLane(patch, PERCUSSION_ACCENT, "", 1);
  Object.assign(percussionAccent, { steps: 8, shape: "sqr" });

  const cymbal = patch.blocks.find((block) => block.voice === "cym")!;
  const rimCall = patch.blocks.find((block) => block.voice === "rim" && euclidHit(3, block.steps, block.pulses, block.rot))!;
  const rimAnswer = patch.blocks.find((block) => block.voice === "rim" && euclidHit(6, block.steps, block.pulses, block.rot))!;
  const clap = patch.blocks.find((block) => block.voice === "clap")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  ending(cymbal, 3, 8, 0);
  ending(openHat, 3, 0, 0);

  // Parallel compression brings the interlocking percussion forward.
  // The short lead slap is separate from the dry timing of the drums.
  Object.assign(effects.compressor, { enabled: true, threshold: -23, ratio: 4, knee: 16, attack: 12, release: 95, makeup: 0, return: 38 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 6, lowCut: 700, damping: 4500, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/16", feedback: 12, lowCut: 1100, tone: 3800, return: 42 });
  effects.sends.kick.compressor = 30;
  effects.sends.rim.compressor = 48;
  effects.sends.lt.compressor = 42;
  effects.sends.clap.compressor = 38;
  effects.sends.rim.reverb = 22;
  effects.sends.lt.reverb = 24;
  effects.sends.clap.reverb = 28;
  effects.sends.cow.reverb = 18;
  effects.sends.lead.reverb = 30;
  effects.sends.lead.delay = 48;

  if (variation === 1) {
    ending(bass, 1, 4, 3);
    ending(lead, 1, 1, 7);
    ending(cowbell, 3, 2, 7);
    ending(openHat, 3, 2, 4);
    cymbal.series = [];
    voices.bassline.custom.cutoff = 580;
    voices.lead.custom.cutoff = 2700;
  } else if (variation === 2) {
    // Retain the stomping kick while exposing a simpler rim/tom dialogue.
    rimAnswer.mute = true;
    clap.mute = true;
    openHat.mute = true;
    Object.assign(cymbal, { pulses: 4, repeats: 1, series: [] });
    bass.pulses = 2;
    ending(bass, 1, 1, 5);
    lead.pulses = 1;
    ending(lead, 1, 1, 15);
    voices.bassline.custom.cutoff = 240;
    voices.lead.custom.cutoff = 1200;
    voices.lead.custom.release = 340;
  } else if (variation === 3) {
    // Rim/tom/rim/tom close the second bar; the last pair is softer.
    // Keep every floor kick while clearing synths and cymbal for the trade.
    percussionAccent.steps = 4;
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 1, rot: 3, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    rimCall.series = [
      { id: `${rimCall.rhythmId}-short`, steps: 12, pulses: 1, rot: 9, repeats: 1 },
      { id: `${rimCall.rhythmId}-trade`, steps: 4, pulses: 2, rot: 0, repeats: 1 },
    ];
    rimAnswer.series = [
      { id: `${rimAnswer.rhythmId}-short`, steps: 12, pulses: 1, rot: 6, repeats: 1 },
      { id: `${rimAnswer.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    lowTom.series = [
      { id: `${lowTom.rhythmId}-short`, steps: 12, pulses: 1, rot: 11, repeats: 1 },
      { id: `${lowTom.rhythmId}-trade`, steps: 4, pulses: 2, rot: 3, repeats: 1 },
    ];
    cymbal.repeats = 1;
    cymbal.series = [
      { id: `${cymbal.rhythmId}-short`, steps: 12, pulses: 9, rot: 0, repeats: 1 },
      { id: `${cymbal.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(openHat, 1, 0, 0);
  }
}
