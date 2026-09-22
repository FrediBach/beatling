import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the three kick components, clap and hats. Keep synth,
// percussion and modulation addresses stable throughout the arrangement.
const BASS = 6;
const LEAD = 7;
const RIM = 8;
const LOW_TOM = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

const hitsAt = (block: SequencerBlock, step: number) => euclidHit(step, block.steps, block.pulses, block.rot);

/** Curate an owned patch: spacious groove, lift, stripped break, short reply. */
export function refineHalfTimeBassGroove(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 88, decay: 82, tune: -4 });
  Object.assign(voices.clap, { level: 74, decay: 38 });
  Object.assign(voices.ch, { level: 40, decay: 22 });
  Object.assign(voices.oh, { level: 40, decay: 46 });
  Object.assign(voices.rim, { level: 42, decay: 26 });
  Object.assign(voices.lt, { level: 54, decay: 34 });

  // Two-bar pitch ramps unfold an E-flat-minor-pentatonic phrase above the
  // 808's low end. A triangle-based 101 holds its answer across the gaps.
  Object.assign(voices.bassline, { level: 54, decay: 42 });
  Object.assign(voices.bassline.custom, {
    root: 3, scale: 5, octave: 2, waveform: 1, cutoff: 300,
    resonance: 3, envelopeAmount: 36, filterDecay: 240, accent: 12,
  });
  Object.assign(voices.lead, { level: 36, decay: 46 });
  Object.assign(voices.lead.custom, {
    root: 3, scale: 5, octave: 3, waveform: 2, pulseMix: 18,
    detune: 6, cutoff: 1600, resonance: 1.6, envelopeAmount: 24, attack: 18, release: 680,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: -0.22 }];

  const bass = setLane(patch, BASS, "bassline", 2, 2);
  ending(bass, 3, 1, 10);
  const lead = setLane(patch, LEAD, "lead", 1, 4);
  ending(lead, 1, 1, 12);
  const rim = setLane(patch, RIM, "rim", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  for (const slot of [BASS_PITCH, LEAD_PITCH]) {
    const pitch = setLane(patch, slot, "", 1);
    pitch.steps = 32;
    pitch.shape = "ramp";
  }
  const accent = setLane(patch, HAT_ACCENT, "", 1);
  accent.steps = 8;
  accent.shape = "tri";

  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  // Alternate full sixteenths with eighths so the second bar can breathe.
  ending(hats, 1, 8, 0);

  // The kick and bass stay dry. Filtered studio reverb and quarter echoes
  // sustain the softer lead while a small clap send outlines the backbeat.
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 20, lowCut: 700, damping: 4000, return: 52 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/4", feedback: 25, lowCut: 900, tone: 2800, return: 58 });
  effects.sends.clap.reverb = 26;
  effects.sends.oh.reverb = 12;
  effects.sends.rim.reverb = 20;
  effects.sends.lt.reverb = 24;
  effects.sends.lead.reverb = 58;
  effects.sends.lead.delay = 58;

  if (variation === 1) {
    // Open the melody and restore continuous hats without moving the clap.
    bass.pulses = 4;
    bass.rot = 13;
    ending(bass, 3, 6, 1);
    ending(lead, 1, 2, 4);
    ending(rim, 3, 1, 15);
    hats.series = [];
    voices.bassline.custom.cutoff = 440;
    voices.lead.custom.cutoff = 2000;
    voices.lead.level = 40;
  } else if (variation === 2) {
    // Keep only the downbeat kick and the beat-three clap. The synths carry
    // the two-bar response while offbeat eighth-note hats retain motion.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && !hitsAt(block, 0)) block.mute = true;
    }
    Object.assign(hats, { pulses: 4, rot: 2, series: [] });
    openHat.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 1, 10);
    voices.bassline.custom.cutoff = 220;
    effects.sends.lead.delay = 68;
  } else if (variation === 3) {
    // A short low-tom/rim reply closes bar two. Clear its late kick, bass
    // and hats so the ending has space, then the original groove returns.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 13)) ending(block, 1, 0, 0);
    }
    ending(bass, 1, 1, 2);
    ending(lead, 1, 1, 10);
    ending(openHat, 1, 1, 3);
    ending(lowTom, 1, 1, 14);
    ending(rim, 1, 1, 15);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
