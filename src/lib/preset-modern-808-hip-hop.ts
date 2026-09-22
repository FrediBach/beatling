import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–7 retain the original drum layers. Synths and their pitch/accent
// sources keep fixed addresses across all four variations.
const BASS = 8;
const LEAD = 9;
const HAT_ROLL = 10;
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

/** Curate an owned patch: minor groove, melodic lift, rim break, hat roll. */
export function refineModern808HipHop(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 62, tune: -1 });
  Object.assign(voices.snare, { level: 64, decay: 38, tune: -1 });
  Object.assign(voices.rim, { level: 42, decay: 26 });
  Object.assign(voices.ch, { level: 38, decay: 22 });
  Object.assign(voices.oh, { level: 34, decay: 30 });

  // A two-bar F-sharp minor bass phrase sits above the 808 kick. The short
  // pulse lead leaves space for filtered dotted-eighth echoes.
  Object.assign(voices.bassline, { level: 58, decay: 50 });
  Object.assign(voices.bassline.custom, {
    root: 6, scale: 2, octave: 2, waveform: 1, cutoff: 280,
    resonance: 2.2, envelopeAmount: 24, filterDecay: 380, accent: 12,
  });
  Object.assign(voices.lead, { level: 32, decay: 32 });
  Object.assign(voices.lead.custom, {
    root: 6, scale: 2, octave: 4, waveform: 1, pulseMix: 35,
    detune: 4, cutoff: 1750, resonance: 1.8, envelopeAmount: 24, attack: 4, release: 240,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.45 }];

  const bass = setLane(patch, BASS, "bassline", 2, 1);
  ending(bass, 1, 2, 3);
  const lead = setLane(patch, LEAD, "lead", 1, 7);
  ending(lead, 1, 1, 3);
  const hatRoll = setLane(patch, HAT_ROLL, "ch", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, shape: "tri" });
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });

  const snare = patch.blocks.find((block) => block.voice === "snare")!;
  const rim = patch.blocks.find((block) => block.voice === "rim")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  const hats = patch.blocks.filter((block, slot) => block.voice === "ch" && slot !== HAT_ROLL);
  ending(openHat, 1, 0, 0);

  // Keep low-frequency ambience dry. A little parallel saturation makes
  // the upper bass audible while the rim and lead share a dark room tail.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 18, tone: 1300, return: 36 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 22, lowCut: 650, damping: 4200, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 24, lowCut: 700, tone: 3200, return: 46 });
  effects.sends.bassline.distortion = 26;
  effects.sends.snare.reverb = 24;
  effects.sends.rim.reverb = 18;
  effects.sends.rim.delay = 24;
  effects.sends.lead.reverb = 38;
  effects.sends.lead.delay = 54;

  if (variation === 1) {
    bass.pulses = 4;
    ending(bass, 1, 4, 3);
    lead.pulses = 2;
    ending(lead, 1, 2, 3);
    openHat.series = [];
    voices.bassline.custom.cutoff = 380;
    voices.lead.custom.cutoff = 2250;
    voices.lead.level = 36;
  } else if (variation === 2) {
    // Let the rim carry beats two/four while the synth response remains.
    snare.mute = true;
    rim.rot = 12;
    openHat.mute = true;
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 6)) block.mute = true;
    }
    for (const block of hats) {
      if (hitsAt(block, 5)) block.mute = true;
      else Object.assign(block, { pulses: 4, rot: 14 });
    }
    bass.pulses = 1;
    ending(bass, 1, 1, 3);
    voices.bassline.custom.cutoff = 220;
    voices.lead.custom.cutoff = 1250;
    effects.sends.lead.delay = 62;
  } else if (variation === 3) {
    // Clear the melodic answer and hat pickups in bar two, then make one
    // sixteenth-note roll on its final beat. No doubled hat triggers.
    ending(bass, 1, 1, 3);
    ending(lead, 1, 0, 0);
    ending(rim, 1, 1, 14);
    for (const block of hats) {
      if (hitsAt(block, 5)) ending(block, 1, 0, 0);
      else {
        block.repeats = 1;
        block.series = [
          { id: `${block.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
          { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
        ];
      }
    }
    hatRoll.series = [
      { id: `${hatRoll.rhythmId}-wait`, steps: 12, pulses: 0, rot: 0, repeats: 1 },
      { id: `${hatRoll.rhythmId}-roll`, steps: 4, pulses: 4, rot: 0, repeats: 1 },
    ];
  }
}
