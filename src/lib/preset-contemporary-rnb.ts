import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the two kick hits, clap, offbeat hats, hat pickup and rim.
const BASS = 6;
const LEAD = 7;
const OPEN_HAT = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const LEAD_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: descending minor bass, melodic lift, half-time rim break, bass/rim ending. */
export function refineContemporaryRnb(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 82, decay: 48, tune: -6 });
  Object.assign(voices.clap, { level: 56, decay: 42 });
  Object.assign(voices.ch, { level: 31, decay: 18 });
  Object.assign(voices.rim, { level: 37, decay: 24 });
  Object.assign(voices.oh, { level: 25, decay: 26 });
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.38 }];
  voices.rim.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.25 }];

  // An inverted pitch ramp walks C-sharp–B–A–G-sharp below the 303 root.
  // The triangle 101 answers E/G-sharp over four bars; its last reply is gentler.
  Object.assign(voices.bassline, { level: 52, decay: 46 });
  Object.assign(voices.bassline.custom, {
    root: 1, scale: 2, octave: 2, waveform: 1, cutoff: 200,
    resonance: 1.6, envelopeAmount: 18, filterDecay: 400, accent: 8,
  });
  Object.assign(voices.lead, { level: 30, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 1, scale: 2, octave: 4, waveform: 2, pulseMix: 18, detune: 5,
    cutoff: 1800, resonance: 1.5, envelopeAmount: 20, attack: 18, release: 640,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: -6 / 12 }];
  voices.lead.modulations = [
    { source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 },
    { source: `${LEAD_ACCENT}`, destination: "level", amount: 0.12 },
    { source: `${LEAD_ACCENT}`, destination: "decay", amount: 0.14 },
  ];

  const bass = setLane(patch, BASS, "bassline", 2, 1);
  ending(bass, 1, 2, 5);
  const lead = setLane(patch, LEAD, "lead", 1);
  Object.assign(lead, { steps: 32, rot: 27 });
  lead.series = [{ id: `${lead.rhythmId}-answer`, steps: 32, pulses: 2, rot: 21, repeats: 1 }];
  const openHat = setLane(patch, OPEN_HAT, "oh", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 31, shape: "ramp" });
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, LEAD_ACCENT, "", 1), { steps: 32, shape: "sqr" });

  const [, lateKick, clap, hats, hatPickup, rim] = patch.blocks;
  ending(hatPickup, 3, 0, 0);
  ending(rim, 3, 1, 15);
  // Quiet saturation adds upper bass harmonics. High-passed studio tails
  // and dotted echoes surround the lead without washing out the low end.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 12, tone: 1800, return: 32 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 32, lowCut: 700, damping: 3000, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 24, lowCut: 900, tone: 2400, return: 46 });
  effects.sends.bassline.distortion = 26;
  effects.sends.clap.reverb = 36;
  effects.sends.rim.reverb = 16;
  effects.sends.lead.reverb = 62;
  effects.sends.lead.delay = 48;

  if (variation === 1) {
    bass.pulses = 4;
    Object.assign(lead, { steps: 16, pulses: 2, rot: 11 });
    ending(lead, 1, 2, 3);
    Object.assign(hats, { pulses: 8, rot: 0 });
    ending(hatPickup, 3, 1, 15);
    ending(openHat, 3, 1, 12);
    voices.bassline.custom.cutoff = 290;
    voices.lead.custom.cutoff = 2300;
  } else if (variation === 2) {
    lateKick.mute = true;
    clap.mute = true;
    hatPickup.mute = true;
    Object.assign(hats, { pulses: 2, rot: 6 });
    Object.assign(rim, { pulses: 1, rot: 8, repeats: 1, series: [] });
    bass.pulses = 1;
    ending(bass, 1, 1, 5);
    lead.series = [];
    voices.bassline.custom.cutoff = 140;
    Object.assign(voices.lead.custom, { cutoff: 1150, release: 1000 });
    effects.sends.lead.delay = 56;
  } else if (variation === 3) {
    // Retain the broken kick and half-time clap. The A/G-sharp bass
    // answer is followed by a soft rim at 31, with the hat pickup out of its way.
    bass.pulses = 1;
    Object.assign(lead, { steps: 16, rot: 11 });
    ending(lead, 1, 0, 0);
    ending(hatPickup, 1, 0, 0);
    ending(rim, 1, 1, 15);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 3, rot: 10, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
