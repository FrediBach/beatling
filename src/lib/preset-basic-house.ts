import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–2 retain the 909 kick/hats and 808 clap. Added parts and their
// modulation sources keep fixed addresses across all four variations.
const BASS = 3;
const LEAD = 4;
const SHAKER = 5;
const RIM = 6;
const MID_TOM = 7;
const LOW_TOM = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const PERCUSSION_ACCENT = 14;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: house groove, shaker lift, kick break, tom return. */
export function refineBasicHouse(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 48, tune: 0 });
  Object.assign(voices.clap, { level: 64, decay: 38 });
  Object.assign(voices.ch, { level: 42, decay: 24 });
  Object.assign(voices.shk, { level: 28, decay: 22 });
  Object.assign(voices.rim, { level: 40, decay: 24 });
  Object.assign(voices.mt, { level: 46, decay: 30 });
  Object.assign(voices.lt, { level: 50, decay: 32 });

  // C/G offbeat bass anchors a short E/B-flat hook. Mixolydian gives the
  // major third and flat seventh without turning this into an acid preset.
  Object.assign(voices.bassline, { level: 60, decay: 36 });
  Object.assign(voices.bassline.custom, {
    root: 0, scale: 4, octave: 2, waveform: 1, cutoff: 360,
    resonance: 2.4, envelopeAmount: 28, filterDecay: 180, accent: 10,
  });
  Object.assign(voices.lead, { level: 34, decay: 34 });
  Object.assign(voices.lead.custom, {
    root: 0, scale: 4, octave: 4, waveform: 0, pulseMix: 20,
    detune: 6, cutoff: 2200, resonance: 1.6, envelopeAmount: 24, attack: 3, release: 220,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.18 }];
  voices.shk.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.25 }];

  const bass = setLane(patch, BASS, "bassline", 4, 2);
  ending(bass, 3, 2, 3);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 0, 0);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  const rim = setLane(patch, RIM, "rim", 0);
  ending(rim, 3, 1, 15);
  const midTom = setLane(patch, MID_TOM, "mt", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { rot: 8, shape: "sqr" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { rot: 3, shape: "ramp" });
  Object.assign(setLane(patch, PERCUSSION_ACCENT, "", 1), { steps: 8, shape: "sqr" });

  const kick = patch.blocks.find((block) => block.voice === "kick")!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;

  // Short ambience keeps the clap crisp; a filtered eighth-note return
  // answers the lead. Keep the kick and bass clear of reverb and delay.
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 12, lowCut: 650, damping: 5500, return: 50 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 22, lowCut: 900, tone: 3800, return: 48 });
  Object.assign(effects.compressor, { enabled: true, threshold: -20, ratio: 3, knee: 20, attack: 18, release: 120, makeup: 0, return: 32 });
  effects.sends.kick.compressor = 32;
  effects.sends.clap.compressor = 36;
  effects.sends.clap.reverb = 32;
  effects.sends.rim.reverb = 18;
  effects.sends.mt.reverb = 22;
  effects.sends.lt.reverb = 22;
  effects.sends.lead.reverb = 40;
  effects.sends.lead.delay = 56;

  if (variation === 1) {
    // Keep all four bass offbeats while the quiet shaker and answering
    // lead phrase lift the same kick/clap/hat foundation.
    bass.series = [];
    ending(lead, 1, 2, 7);
    Object.assign(shaker, { pulses: 8, rot: 15 });
    voices.bassline.custom.cutoff = 480;
    voices.lead.custom.cutoff = 2700;
    voices.lead.level = 38;
  } else if (variation === 2) {
    // A two-bar kick break retains the clap while the bass and delayed
    // hook carry the harmony into the returning four-on-the-floor beat.
    kick.mute = true;
    Object.assign(hats, { pulses: 2, rot: 10 });
    Object.assign(bass, { pulses: 2, series: [] });
    Object.assign(lead, { pulses: 1, rot: 5 });
    ending(lead, 1, 1, 3);
    rim.mute = true;
    voices.bassline.custom.cutoff = 260;
    voices.lead.custom.cutoff = 1600;
    effects.sends.lead.delay = 64;
  } else if (variation === 3) {
    // Keep every quarter-note kick and both claps. Bar two clears the
    // synths and final hat for a mid-tom, low-tom, rim turnaround.
    ending(bass, 1, 1, 2);
    ending(midTom, 1, 1, 13);
    ending(lowTom, 1, 1, 14);
    ending(rim, 1, 1, 15);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 3, rot: 10, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
