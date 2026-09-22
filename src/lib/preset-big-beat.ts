import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–6 retain two kick parts, backbeat/ghost snare, two hats and crash.
const BASS = 7;
const LEAD = 8;
const CLAP = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const DRUM_ACCENT = 14;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: heavy riff, layered lift, filtered break, double-and-stop ending. */
export function refineBigBeat(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 88, decay: 34, tune: -2 });
  Object.assign(voices.snare, { level: 63, decay: 36 });
  Object.assign(voices.ch, { level: 38, decay: 22 });
  Object.assign(voices.cym, { level: 36, decay: 28 });
  Object.assign(voices.clap, { level: 32, decay: 24 });
  voices.snare.modulations = [
    { source: `${DRUM_ACCENT}`, destination: "level", amount: 0.4 },
    { source: `${DRUM_ACCENT}`, destination: "decay", amount: 0.1 },
  ];
  voices.ch.modulations = [{ source: `${DRUM_ACCENT}`, destination: "level", amount: 0.3 }];

  // C/E-flat/F/E-flat bass sits between kick attacks. A brassy 101
  // calls C/F, rests a bar, then answers C/F/G across the four-bar phrase.
  Object.assign(voices.bassline, { level: 62, decay: 34 });
  Object.assign(voices.bassline.custom, {
    root: 0, scale: 5, octave: 2, waveform: 0, cutoff: 580,
    resonance: 3.8, envelopeAmount: 44, filterDecay: 180, accent: 20,
  });
  Object.assign(voices.lead, { level: 34, decay: 30 });
  Object.assign(voices.lead.custom, {
    root: 0, scale: 5, octave: 3, waveform: 0, pulseMix: 28, detune: 11,
    cutoff: 2500, resonance: 1.6, envelopeAmount: 30, attack: 4, release: 220,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 5 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 10 / 12 }];
  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 1, 2, 1);
  const lead = setLane(patch, LEAD, "lead", 2, 7);
  lead.series = [
    { id: `${lead.rhythmId}-rest`, steps: 16, pulses: 0, rot: 0, repeats: 1 },
    { id: `${lead.rhythmId}-call`, steps: 16, pulses: 2, rot: 9, repeats: 1 },
    { id: `${lead.rhythmId}-answer`, steps: 16, pulses: 1, rot: 13, repeats: 1 },
  ];
  const clap = setLane(patch, CLAP, "clap", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 30, shape: "tri" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, rot: 25, shape: "tri" });
  Object.assign(setLane(patch, DRUM_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [kick, pickupKick, snare, ghostSnare, hats, pickupHats, crash] = patch.blocks;
  crash.series = [{ id: `${crash.rhythmId}-rest`, steps: 16, pulses: 0, rot: 0, repeats: 3 }];
  // Hard-clipped bass and parallel drum compression supply weight without
  // sending the low end into the room or the dotted melodic echoes.
  Object.assign(effects.distortion, { enabled: true, mode: "hard", drive: 32, trim: -3, tone: 3200, return: 38 });
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 5, knee: 12, attack: 24, release: 180, makeup: 0, return: 42 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 14, lowCut: 900, damping: 4200, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 20, lowCut: 1100, tone: 3400, return: 42 });
  effects.sends.bassline.distortion = 48;
  effects.sends.kick.compressor = 44;
  effects.sends.snare.compressor = 48;
  effects.sends.clap.compressor = 30;
  effects.sends.snare.reverb = 30;
  effects.sends.clap.reverb = 24;
  effects.sends.lead.reverb = 30;
  effects.sends.lead.delay = 44;

  if (variation === 1) {
    ending(bass, 1, 3, 3);
    ending(lead, 1, 2, 3);
    Object.assign(clap, { pulses: 2, rot: 12 });
    crash.series[0].repeats = 1;
    voices.bassline.custom.cutoff = 850;
    voices.lead.custom.cutoff = 3200;
  } else if (variation === 2) {
    pickupKick.mute = true;
    ghostSnare.mute = true;
    pickupHats.mute = true;
    crash.mute = true;
    Object.assign(hats, { pulses: 4, rot: 2 });
    bass.pulses = 1;
    ending(bass, 1, 1, 1);
    lead.pulses = 0;
    ending(lead, 1, 1, 11);
    Object.assign(voices.bassline.custom, { cutoff: 300, envelopeAmount: 28 });
    Object.assign(voices.lead.custom, { cutoff: 1700, release: 360 });
    effects.sends.bassline.distortion = 30;
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Bar two ends with snares at 24/26, the second softer and shorter.
    // No new attacks in the last beat; the delay carries the transition.
    ending(kick, 1, 1, 0);
    ending(pickupKick, 1, 1, 6);
    ending(ghostSnare, 1, 0, 0);
    snare.series = [
      { id: `${snare.rhythmId}-backbeat`, steps: 8, pulses: 1, rot: 4, repeats: 1 },
      { id: `${snare.rhythmId}-double`, steps: 4, pulses: 2, rot: 0, repeats: 1 },
      { id: `${snare.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(bass, 1, 1, 2);
    ending(lead, 1, 0, 0);
    crash.series[0].repeats = 1;
    for (const block of [hats, pickupHats]) {
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 8, pulses: block === hats ? 4 : 1, rot: block === hats ? 0 : 5, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
