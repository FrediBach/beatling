import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–6 retain the layered kick, backbeat and hats. Keep the added parts
// and their modulation sources at fixed addresses throughout the song.
const BASS = 7;
const LEAD = 8;
const RIM = 10;
const GHOST_SNARE = 11;
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

const hitsAt = (block: SequencerBlock, step: number) => euclidHit(step, block.steps, block.pulses, block.rot);

/** Curate an owned patch: swung groove, ghost-note lift, break, rim ending. */
export function refineBoomBap(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 48, tune: -2 });
  Object.assign(voices.snare, { level: 66, decay: 44, tune: -1 });
  Object.assign(voices.ch, { level: 42, decay: 26 });
  Object.assign(voices.oh, { level: 38, decay: 36 });
  Object.assign(voices.rim, { level: 42, decay: 28 });

  // Low resonance and a small filter envelope keep the 303 rounded. Dorian
  // brings a major sixth to the minor phrase; the 101 is a soft triangle pluck.
  Object.assign(voices.bassline, { level: 60, decay: 46 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 3, octave: 2, waveform: 1, cutoff: 240,
    resonance: 1.5, envelopeAmount: 22, filterDecay: 280, accent: 8,
  });
  Object.assign(voices.lead, { level: 34, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 3, octave: 3, waveform: 2, pulseMix: 0,
    detune: 0, cutoff: 1200, resonance: 1.1, envelopeAmount: 18, attack: 5, release: 300,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.4 }];
  voices.snare.modulations = [{ source: `${SNARE_ACCENT}`, destination: "level", amount: 0.42 }];

  const bass = setLane(patch, BASS, "bassline", 3, 1);
  ending(bass, 3, 2, 1);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 0, 0);
  const rim = setLane(patch, RIM, "rim", 0);
  const ghostSnare = setLane(patch, GHOST_SNARE, "snare", 0);
  ending(ghostSnare, 3, 2, 3);
  setLane(patch, BASS_PITCH, "", 1).shape = "ramp";
  setLane(patch, LEAD_PITCH, "", 1).shape = "tri";
  const hatAccent = setLane(patch, HAT_ACCENT, "", 1);
  hatAccent.steps = 2;
  hatAccent.shape = "sqr";
  const snareAccent = setLane(patch, SNARE_ACCENT, "", 1);
  snareAccent.steps = 4;
  snareAccent.shape = "sqr";

  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  ending(openHat, 3, 0, 0);

  // Parallel compression adds drum weight; a short, dark free-time slap
  // sits behind the 101 without adding a second rhythmic subdivision.
  Object.assign(effects.compressor, { enabled: true, threshold: -24, ratio: 4, knee: 24, attack: 20, release: 180, makeup: 0, return: 46 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 14, lowCut: 500, damping: 3800, return: 52 });
  Object.assign(effects.delay, { enabled: true, sync: false, time: 95, feedback: 8, lowCut: 700, tone: 2200, return: 38 });
  effects.sends.kick.compressor = 42;
  effects.sends.snare.compressor = 52;
  effects.sends.snare.reverb = 32;
  effects.sends.rim.reverb = 20;
  effects.sends.lead.reverb = 42;
  effects.sends.lead.delay = 48;

  if (variation === 1) {
    // Keep the original backbeat and add quiet pickups around it.
    bass.pulses = 4;
    ending(bass, 3, 5, 1);
    ending(lead, 1, 1, 11);
    ghostSnare.pulses = 2;
    ghostSnare.rot = 13;
    ghostSnare.series = [];
    voices.bassline.custom.cutoff = 320;
    voices.lead.level = 38;
  } else if (variation === 2) {
    // Drop one kick and the extra sixteenth hats while the snare still
    // anchors beats two and four. The bass answers across two bars.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 6)) block.mute = true;
      if (block.voice === "ch" && hitsAt(block, 3)) block.mute = true;
    }
    openHat.mute = true;
    ghostSnare.series = [];
    bass.pulses = 2;
    ending(bass, 1, 1, 9);
    voices.lead.custom.cutoff = 950;
    effects.sends.lead.delay = 60;
  } else if (variation === 3) {
    // A soft snare pickup anticipates the final backbeat; a rim answers it
    // on step 14 while the hats and melodic parts leave the last beat open.
    ending(bass, 1, 1, 1);
    ending(ghostSnare, 1, 1, 11);
    ending(rim, 1, 1, 14);
    ending(openHat, 1, 0, 0);
    for (const block of patch.blocks) {
      if (block.voice !== "ch") continue;
      if (hitsAt(block, 3)) ending(block, 1, 0, 0);
      else {
        block.repeats = 1;
        block.series = [
          { id: `${block.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
          { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
        ];
      }
    }
  }
}
