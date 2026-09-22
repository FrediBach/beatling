import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–4 retain two kicks, the half-time snare, rim and eighth-note hats.
const BASS = 5;
const LEAD = 6;
const SHAKER = 7;
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

/** Curate an owned patch: deep half-time groove, rolling lift, spacious break, snare stutter. */
export function refineJungleHalfTime(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 82, decay: 16, tune: -2 });
  Object.assign(voices.snare, { level: 56, decay: 32 });
  Object.assign(voices.rim, { level: 39, decay: 22 });
  Object.assign(voices.ch, { level: 32, decay: 14 });
  Object.assign(voices.shk, { level: 22, decay: 16 });
  for (const voice of ["ch", "shk"] as const) {
    voices[voice].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.3 }];
  }
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.35 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.2 },
  ];

  // D/F/A/F square bass unfolds over two bars. The triangle 101 floats
  // F/G/D above it across four bars, resolving to the root at the end.
  Object.assign(voices.bassline, { level: 60, decay: 38 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 2, octave: 1, waveform: 1, cutoff: 160,
    resonance: 1.6, envelopeAmount: 18, filterDecay: 300, accent: 10,
  });
  Object.assign(voices.lead, { level: 30, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 2, octave: 4, waveform: 2, pulseMix: 8, detune: 5,
    cutoff: 1800, resonance: 1.2, envelopeAmount: 18, attack: 26, release: 720,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  const bass = setLane(patch, BASS, "bassline", 2, 3);
  ending(bass, 1, 2, 5);
  const lead = setLane(patch, LEAD, "lead", 1);
  Object.assign(lead, { steps: 32, rot: 28 });
  lead.series = [{ id: `${lead.rhythmId}-answer`, steps: 32, pulses: 2, rot: 20, repeats: 1 }];
  const shaker = setLane(patch, SHAKER, "shk", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 29, shape: "tri" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, rot: 4, shape: "ramp" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 8, shape: "sqr" });

  const [, displacedKick, snare, rim, hats] = patch.blocks;
  hats.repeats = 3;
  hats.series = [
    { id: `${hats.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
    { id: `${hats.rhythmId}-roll`, steps: 4, pulses: 4, rot: 0, repeats: 1 },
  ];
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 18, tone: 1700, return: 34 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 22, lowCut: 1000, damping: 3600, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 28, lowCut: 1200, tone: 2800, return: 44 });
  effects.sends.bassline.distortion = 38;
  effects.sends.snare.reverb = 28;
  effects.sends.rim.reverb = 20;
  effects.sends.rim.delay = 28;
  effects.sends.lead.reverb = 52;
  effects.sends.lead.delay = 50;

  if (variation === 1) {
    bass.pulses = 4;
    lead.pulses = 2;
    Object.assign(shaker, { pulses: 8, rot: 15 });
    voices.bassline.custom.cutoff = 240;
    voices.lead.custom.cutoff = 2300;
  } else if (variation === 2) {
    displacedKick.mute = true;
    Object.assign(rim, { pulses: 1, rot: 2 });
    Object.assign(hats, { pulses: 4, rot: 2, repeats: 1, series: [] });
    bass.pulses = 1;
    ending(bass, 1, 1, 5);
    lead.series = [];
    voices.bassline.custom.cutoff = 120;
    Object.assign(voices.lead.custom, { cutoff: 1300, release: 1050 });
    effects.sends.lead.reverb = 62;
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Keep the beat-three snare; a rim at 27 introduces three softer,
    // shorter snare hits at 29–31. Clear the other parts before that reply.
    ending(displacedKick, 1, 0, 0);
    snare.series = [
      { id: `${snare.rhythmId}-backbeat`, steps: 12, pulses: 1, rot: 4, repeats: 1 },
      { id: `${snare.rhythmId}-stutter`, steps: 4, pulses: 3, rot: 1, repeats: 1 },
    ];
    rim.series = [
      { id: `${rim.rhythmId}-early`, steps: 8, pulses: 1, rot: 2, repeats: 1 },
      { id: `${rim.rhythmId}-pickup`, steps: 8, pulses: 1, rot: 5, repeats: 1 },
    ];
    ending(bass, 1, 1, 3);
    Object.assign(lead, { steps: 16, rot: 12 });
    ending(lead, 1, 0, 0);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 8, pulses: 4, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
