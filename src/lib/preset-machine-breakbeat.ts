import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain kick, three snare components, closed and open hats.
const BASS = 6;
const LEAD = 7;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const SNARE_ACCENT = 14;
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

/** Curate an owned patch: broken groove, brighter hook, sparse break, chopped ending. */
export function refineMachineBreakbeat(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 22, tune: -1 });
  Object.assign(voices.snare, { level: 58, decay: 30 });
  Object.assign(voices.ch, { level: 38, decay: 20 });
  Object.assign(voices.oh, { level: 35, decay: 20 });
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.6 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.12 },
  ];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.25 }];

  // Short saw notes descend G/F/E-flat/D over two bars, leaving the
  // 808 kick attacks clear. The square 101 answers with root/fifth stabs.
  Object.assign(voices.bassline, { level: 60, decay: 30 });
  Object.assign(voices.bassline.custom, {
    root: 7, scale: 2, octave: 2, waveform: 0, cutoff: 480,
    resonance: 5.2, envelopeAmount: 48, filterDecay: 160, accent: 22,
  });
  Object.assign(voices.lead, { level: 32, decay: 26 });
  Object.assign(voices.lead.custom, {
    root: 7, scale: 2, octave: 3, waveform: 1, pulseMix: 12, detune: -5,
    cutoff: 2200, resonance: 2.4, envelopeAmount: 22, attack: 3, release: 130,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: -0.5 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 1, 2, 5);
  const lead = setLane(patch, LEAD, "lead", 2, 5);
  ending(lead, 1, 1, 7);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 30, shape: "ramp" });
  setLane(patch, LEAD_PITCH, "", 1, 8).shape = "sqr";
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 8, shape: "tri" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const [kick, earlySnare, brokenSnare, backbeat, hats, openHat] = patch.blocks;
  ending(openHat, 3, 0, 0);
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 24, tone: 2600, return: 38 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 800, damping: 4200, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 24, lowCut: 1000, tone: 3000, return: 44 });
  Object.assign(effects.compressor, { enabled: true, threshold: -20, ratio: 4, knee: 18, attack: 20, release: 120, makeup: 0, return: 36 });
  effects.sends.bassline.distortion = 40;
  effects.sends.snare.reverb = 28;
  effects.sends.lead.reverb = 24;
  effects.sends.lead.delay = 50;
  effects.sends.kick.compressor = 36;
  effects.sends.snare.compressor = 40;

  if (variation === 1) {
    ending(bass, 1, 3, 2);
    ending(lead, 1, 2, 3);
    Object.assign(openHat, { repeats: 1, series: [] });
    voices.bassline.custom.cutoff = 720;
    voices.lead.custom.cutoff = 2800;
  } else if (variation === 2) {
    Object.assign(kick, { pulses: 2, rot: 0 });
    earlySnare.mute = true;
    Object.assign(brokenSnare, { pulses: 1, rot: 12 });
    Object.assign(hats, { pulses: 4, rot: 2 });
    openHat.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 1, 5);
    lead.pulses = 0;
    voices.bassline.custom.cutoff = 260;
    Object.assign(voices.lead.custom, { cutoff: 1600, release: 230 });
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Bar two: kick at 16/24, snare at 20/25/28/30/31. The final
    // snare pair softens while bass, lead and hats leave the last beat open.
    ending(kick, 1, 2, 0);
    ending(earlySnare, 1, 0, 0);
    ending(brokenSnare, 1, 1, 4);
    backbeat.series = [
      { id: `${backbeat.rhythmId}-short`, steps: 12, pulses: 1, rot: 3, repeats: 1 },
      { id: `${backbeat.rhythmId}-ending`, steps: 4, pulses: 3, rot: 0, repeats: 1 },
    ];
    ending(bass, 1, 1, 2);
    ending(lead, 1, 0, 0);
    ending(openHat, 1, 0, 0);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
