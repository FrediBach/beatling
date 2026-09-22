import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// The six-hit kick is a single Euclidean lane, so the original drum parts
// occupy slots 0–4. All additions keep fixed addresses across variations.
const BASS = 5;
const LEAD = 6;
const RIM = 7;
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

/** Curate an owned patch: fast groove, lift, half-time break, percussion reply. */
export function refineDoubleTimeBass(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  // Shorten the 808 tail for the six attacks per bar, keeping its weight.
  Object.assign(voices.kick, { level: 86, decay: 52, tune: 0 });
  Object.assign(voices.snare, { level: 72, decay: 30 });
  Object.assign(voices.ch, { level: 42, decay: 18 });
  Object.assign(voices.shk, { level: 36, decay: 22 });
  Object.assign(voices.cym, { level: 28, decay: 24 });
  Object.assign(voices.rim, { level: 46, decay: 24 });
  Object.assign(voices.lt, { level: 56, decay: 30 });

  // Short G-minor-pentatonic parts sit above the kick. The 303 alternates
  // fifth/root while the 101 adds a clipped melodic hook.
  Object.assign(voices.bassline, { level: 56, decay: 28 });
  Object.assign(voices.bassline.custom, {
    root: 7, scale: 5, octave: 2, waveform: 1, cutoff: 340,
    resonance: 4, envelopeAmount: 42, filterDecay: 105, accent: 16,
  });
  Object.assign(voices.lead, { level: 36, decay: 32 });
  Object.assign(voices.lead.custom, {
    root: 7, scale: 5, octave: 3, waveform: 0, pulseMix: 12,
    detune: 4, cutoff: 2300, resonance: 2, envelopeAmount: 34, attack: 3, release: 210,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.22 }];
  voices.shk.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: -0.22 }];

  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 1, 2, 5);
  const lead = setLane(patch, LEAD, "lead", 1, 7);
  ending(lead, 3, 2, 7);
  const rim = setLane(patch, RIM, "rim", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  setLane(patch, BASS_PITCH, "", 1).shape = "sqr";
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  const accent = setLane(patch, PERCUSSION_ACCENT, "", 1);
  accent.steps = 4;
  accent.shape = "sqr";

  const kick = patch.blocks.find((block) => block.voice === "kick")!;
  const snare = patch.blocks.find((block) => block.voice === "snare")!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const shaker = patch.blocks.find((block) => block.voice === "shk")!;
  const cymbal = patch.blocks.find((block) => block.voice === "cym")!;
  // In bar four the even hats and odd shaker interlock; retain the cymbal's
  // original 32-step cycle so its downbeat only appears every other bar.
  ending(hats, 3, 8, 0);

  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 6, lowCut: 700, damping: 5200, return: 54 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/16", feedback: 16, lowCut: 1000, tone: 4400, return: 56 });
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 3, knee: 20, attack: 15, release: 120, makeup: 0, return: 36 });
  effects.sends.snare.reverb = 34;
  effects.sends.rim.reverb = 20;
  effects.sends.lt.reverb = 26;
  effects.sends.lead.reverb = 38;
  effects.sends.lead.delay = 62;
  effects.sends.kick.compressor = 32;
  effects.sends.snare.compressor = 42;

  if (variation === 1) {
    // Fill the spaces between kick attacks with four bass notes per bar.
    bass.pulses = 4;
    bass.rot = 15;
    ending(bass, 3, 4, 1);
    lead.pulses = 2;
    ending(lead, 3, 3, 7);
    hats.series = [];
    voices.bassline.custom.cutoff = 500;
    voices.lead.level = 40;
  } else if (variation === 2) {
    // A two-bar half-time section contrasts the fast groove without
    // changing transport tempo or losing the phrase's downbeat.
    Object.assign(kick, { pulses: 2, rot: 0 });
    Object.assign(snare, { pulses: 1, rot: 8 });
    hats.pulses = 8;
    hats.series = [];
    Object.assign(shaker, { pulses: 4, rot: 1 });
    cymbal.mute = true;
    bass.pulses = 1;
    lead.pulses = 1;
    ending(lead, 1, 2, 7);
    voices.kick.decay = 68;
    voices.bassline.custom.cutoff = 260;
    effects.sends.lead.delay = 68;
  } else if (variation === 3) {
    // Keep the first bar intact; bar two opens up for snare, rim, tom, rim
    // on its last beat. The cymbal's second-bar rest leaves this response clear.
    ending(kick, 1, 2, 0);
    ending(bass, 1, 2, 1);
    ending(lead, 1, 0, 0);
    ending(lowTom, 1, 1, 14);
    rim.series = [
      { id: `${rim.rhythmId}-wait`, steps: 12, pulses: 0, rot: 0, repeats: 1 },
      { id: `${rim.rhythmId}-reply`, steps: 4, pulses: 2, rot: 1, repeats: 1 },
    ];
    for (const block of [hats, shaker]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block.voice === "ch" ? 12 : 6, rot: block.voice === "ch" ? 0 : 1, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
