import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–7 hold the original layered drums. Added parts and their modulation
// sources keep the same addresses in every variation.
const BASS = 8;
const LEAD = 9;
const RIM = 10;
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

const hitsAt = (block: SequencerBlock, step: number) => euclidHit(step, block.steps, block.pulses, block.rot);

/** Curate an owned patch: sparse groove, lift, stripped break, stop-and-answer. */
export function refineStripped808Breakbeat(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 40, tune: -2 });
  Object.assign(voices.snare, { level: 64, decay: 36 });
  Object.assign(voices.ch, { level: 48, decay: 26 });
  Object.assign(voices.oh, { level: 42, decay: 32 });
  Object.assign(voices.rim, { level: 44, decay: 28 });

  // A low root/fifth motif supports the break without filling every gap.
  Object.assign(voices.bassline, { level: 62, decay: 45 });
  Object.assign(voices.bassline.custom, {
    root: 4, scale: 2, octave: 1, waveform: 1, cutoff: 260,
    resonance: 2.8, envelopeAmount: 34, filterDecay: 210, accent: 12,
  });
  Object.assign(voices.lead, { level: 34, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 4, scale: 2, octave: 3, waveform: 2, pulseMix: 10,
    detune: 3, cutoff: 1500, resonance: 1.4, envelopeAmount: 20, attack: 6, release: 340,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.snare.modulations = [{ source: `${DRUM_ACCENT}`, destination: "level", amount: 0.35 }];
  voices.ch.modulations = [{ source: `${DRUM_ACCENT}`, destination: "level", amount: 0.18 }];

  const bass = setLane(patch, BASS, "bassline", 2, 1);
  ending(bass, 3, 2, 5);
  const lead = setLane(patch, LEAD, "lead", 0);
  ending(lead, 1, 1, 7);
  const rim = setLane(patch, RIM, "rim", 0);
  setLane(patch, BASS_PITCH, "", 1).shape = "sqr";
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  const accent = setLane(patch, DRUM_ACCENT, "", 1);
  accent.steps = 4;
  accent.shape = "sqr";

  // The original hat pickup stays audible; the fourth-bar open hat rests.
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  ending(openHat, 3, 0, 0);

  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 8, lowCut: 600, damping: 4200, return: 54 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 18, lowCut: 800, tone: 2800, return: 56 });
  Object.assign(effects.compressor, { enabled: true, threshold: -20, ratio: 3, knee: 18, attack: 18, release: 160, makeup: 0, return: 40 });
  effects.sends.snare.reverb = 30;
  effects.sends.rim.reverb = 24;
  effects.sends.lead.reverb = 42;
  effects.sends.lead.delay = 54;
  effects.sends.kick.compressor = 44;
  effects.sends.snare.compressor = 38;
  effects.sends.bassline.compressor = 28;

  if (variation === 1) {
    // A small melodic lift; the kick/snare break keeps its original shape.
    bass.pulses = 3;
    ending(bass, 3, 4, 1);
    lead.pulses = 1;
    lead.rot = 13; // Step 3, followed by the step-7 answer next bar.
    ending(rim, 3, 1, 15);
    ending(openHat, 3, 2, 6);
    voices.bassline.custom.cutoff = 380;
    voices.lead.level = 38;
  } else if (variation === 2) {
    // Remove the kick on step 6 and the snare/hat pickups, retaining the
    // original off-center kick on step 10 and backbeats on steps 4/12.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 6)) block.mute = true;
      if (block.voice === "snare" && hitsAt(block, 11)) block.mute = true;
      if (block.voice === "ch") {
        if (hitsAt(block, 15)) block.mute = true;
        else Object.assign(block, { pulses: 4, rot: 2 });
      }
    }
    openHat.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 1, 9);
    voices.bassline.custom.cutoff = 200;
    effects.sends.lead.delay = 66;
  } else if (variation === 3) {
    // Let the last backbeat and a single rim answer finish bar two; the
    // hats and bass withdraw rather than piling on a conventional fill.
    ending(bass, 1, 1, 1);
    lead.pulses = 1;
    lead.rot = 13;
    ending(lead, 1, 0, 0);
    ending(rim, 1, 1, 15);
    ending(openHat, 1, 0, 0);
    for (const block of patch.blocks) {
      if (block.voice !== "ch") continue;
      if (hitsAt(block, 15)) ending(block, 1, 0, 0);
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
