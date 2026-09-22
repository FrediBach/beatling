import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–4 retain the kick, snare, rim and two hat layers. The global
// clock runs at 32nd-note resolution, with 32 steps per bar.
const BASS = 5;
const LEAD = 6;
const BASS_PICKUP = 7;
const HAT_ENDING = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, steps: 32, pulses, rot: (32 - offset) % 32 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 32, pulses, rot: (32 - offset) % 32, repeats: 1 }];
}

const hitsAt = (block: SequencerBlock, step: number) => euclidHit(step, block.steps, block.pulses, block.rot);

/** Curate an owned patch: displaced backbeat, octave lift, rim break, bass pickup. */
export function refineDrillVariant(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 62, tune: -5 });
  Object.assign(voices.snare, { level: 66, decay: 32 });
  Object.assign(voices.rim, { level: 44, decay: 22 });
  Object.assign(voices.ch, { level: 38, decay: 16 });

  // A muted square bass jumps between D2 and D3; the sustained triangle
  // lead places a B-flat/F response over that pedal without crowding it.
  Object.assign(voices.bassline, { level: 60, decay: 56 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 2, octave: 2, waveform: 1, cutoff: 220,
    resonance: 1.8, envelopeAmount: 18, filterDecay: 330, accent: 10,
  });
  Object.assign(voices.lead, { level: 32, decay: 44 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 2, octave: 4, waveform: 2, pulseMix: 8,
    detune: 0, cutoff: 1200, resonance: 1.2, envelopeAmount: 10, attack: 30, release: 500,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.48 }];

  const bass = setLane(patch, BASS, "bassline", 3, 3);
  ending(bass, 1, 2, 6);
  const lead = setLane(patch, LEAD, "lead", 1, 11);
  ending(lead, 1, 1, 27);
  const bassPickup = setLane(patch, BASS_PICKUP, "bassline", 0);
  const hatEnding = setLane(patch, HAT_ENDING, "ch", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { rot: 16, shape: "sqr" });
  setLane(patch, LEAD_PITCH, "", 1).shape = "tri";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });

  const kick = patch.blocks.find((block) => block.voice === "kick")!;
  const snare = patch.blocks.find((block) => block.voice === "snare")!;
  const rim = patch.blocks.find((block) => block.voice === "rim")!;
  const hats = patch.blocks.find((block) => block.voice === "ch" && hitsAt(block, 0))!;
  const hatPickups = patch.blocks.find((block) => block.voice === "ch" && hitsAt(block, 13))!;
  // Keep the original first bar; delay the second bar's snare by an
  // eighth note and leave its extra hat pickups silent.
  ending(snare, 1, 1, 20);
  ending(hatPickups, 1, 0, 0);
  ending(rim, 3, 1, 24);

  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 32, tone: 1800, return: 42 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 36, lowCut: 900, damping: 2800, return: 48 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 20, lowCut: 1000, tone: 2400, return: 44 });
  effects.sends.bassline.distortion = 40;
  effects.sends.snare.reverb = 22;
  effects.sends.rim.reverb = 16;
  effects.sends.lead.reverb = 60;
  effects.sends.lead.delay = 42;

  if (variation === 1) {
    bass.pulses = 4;
    ending(bass, 1, 4, 6);
    lead.pulses = 2;
    ending(lead, 1, 1, 19);
    hatPickups.series = [];
    voices.bassline.custom.cutoff = 320;
    voices.lead.custom.cutoff = 1600;
    voices.lead.level = 36;
  } else if (variation === 2) {
    // Let the rim mark beat three over one kick and four offbeat hats.
    kick.pulses = 1;
    snare.mute = true;
    Object.assign(rim, { rot: 16, series: [] });
    Object.assign(hats, { pulses: 4, rot: 28 });
    hatPickups.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 1, 6);
    voices.bassline.custom.cutoff = 160;
    voices.lead.custom.cutoff = 1000;
    effects.sends.lead.delay = 60;
  } else if (variation === 3) {
    // Bar two drops its second kick and clears the melody. A two-hit hat
    // stutter leads into one exposed upper-octave bass pickup, then a rest.
    ending(kick, 1, 1, 0);
    ending(bass, 1, 1, 6);
    ending(lead, 1, 0, 0);
    ending(rim, 1, 1, 8);
    ending(bassPickup, 1, 1, 30);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 28, pulses: 7, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    hatEnding.series = [
      { id: `${hatEnding.rhythmId}-wait`, steps: 28, pulses: 0, rot: 0, repeats: 1 },
      { id: `${hatEnding.rhythmId}-stutter`, steps: 2, pulses: 2, rot: 0, repeats: 1 },
      { id: `${hatEnding.rhythmId}-rest`, steps: 2, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
