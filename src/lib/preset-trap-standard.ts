import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// The original drums occupy slots 0–7. All parts use the global 32nd-note
// clock; 32 steps form one bar at this preset's rate of 8.
const BASS = 8;
const LEAD = 9;
const GHOST_SNARE = 10;
const RIM = 11;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const SNARE_ACCENT = 15;

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

/** Curate an owned patch: half-time groove, lift, clap break, snare pickup. */
export function refineTrapStandard(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 88, decay: 58, tune: -2 });
  Object.assign(voices.snare, { level: 62, decay: 30 });
  Object.assign(voices.clap, { level: 46, decay: 34 });
  Object.assign(voices.ch, { level: 34, decay: 16 });
  Object.assign(voices.oh, { level: 32, decay: 26 });
  Object.assign(voices.rim, { level: 44, decay: 22 });

  // Root/fifth square bass sits above the long 808 kick. A triangle-led
  // minor-pentatonic phrase rings out, then leaves the next bar open.
  Object.assign(voices.bassline, { level: 56, decay: 58 });
  Object.assign(voices.bassline.custom, {
    root: 5, scale: 5, octave: 2, waveform: 1, cutoff: 180,
    resonance: 1.4, envelopeAmount: 12, filterDecay: 440, accent: 8,
  });
  Object.assign(voices.lead, { level: 34, decay: 42 });
  Object.assign(voices.lead.custom, {
    root: 5, scale: 5, octave: 4, waveform: 2, pulseMix: 18,
    detune: 7, cutoff: 2600, resonance: 2.2, envelopeAmount: 12, attack: 2, release: 640,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: -0.45 }];
  voices.snare.modulations = [{ source: `${SNARE_ACCENT}`, destination: "level", amount: 0.4 }];

  const bass = setLane(patch, BASS, "bassline", 2, 4);
  ending(bass, 1, 2, 6);
  const lead = setLane(patch, LEAD, "lead", 2, 10);
  ending(lead, 1, 0, 0);
  const ghostSnare = setLane(patch, GHOST_SNARE, "snare", 0);
  const rim = setLane(patch, RIM, "rim", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { rot: 16, shape: "sqr" });
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "ramp" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 8, shape: "sqr" });

  const snare = patch.blocks.find((block) => block.voice === "snare")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  const hats = patch.blocks.filter((block) => block.voice === "ch");
  const hatPickups = hats.find((block) => hitsAt(block, 13))!;
  // Leave the fourth bar's sixteenths uncluttered before the next section.
  ending(hatPickups, 3, 0, 0);
  ending(openHat, 3, 0, 0);

  Object.assign(effects.reverb, { enabled: true, space: "hall", preDelay: 22, lowCut: 1000, damping: 4800, return: 42 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/4", feedback: 22, lowCut: 1000, tone: 3600, return: 46 });
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 22, tone: 1400, return: 34 });
  effects.sends.bassline.distortion = 30;
  effects.sends.clap.reverb = 26;
  effects.sends.snare.reverb = 14;
  effects.sends.rim.reverb = 18;
  effects.sends.lead.reverb = 60;
  effects.sends.lead.delay = 44;

  if (variation === 1) {
    bass.pulses = 3;
    ending(bass, 1, 3, 6);
    ending(lead, 1, 1, 18);
    ending(hatPickups, 3, 4, 5);
    openHat.series = [];
    voices.bassline.custom.cutoff = 260;
    voices.lead.custom.cutoff = 3200;
    voices.lead.level = 38;
  } else if (variation === 2) {
    // Keep the clap on beat three, with one kick and eight hats per bar.
    snare.mute = true;
    openHat.mute = true;
    hatPickups.mute = true;
    for (const block of patch.blocks) {
      if (block.voice === "kick" && !hitsAt(block, 0)) block.mute = true;
    }
    for (const block of hats) {
      if (block !== hatPickups) block.pulses = 8;
    }
    bass.pulses = 1;
    ending(bass, 1, 0, 0);
    lead.pulses = 1;
    ending(lead, 1, 1, 26);
    voices.bassline.custom.cutoff = 160;
    voices.lead.custom.cutoff = 2000;
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Bar two ends with two softer snare hits and a rim reply. The hats,
    // last kick and synths make room before the next downbeat.
    ending(bass, 1, 1, 4);
    ending(hatPickups, 1, 0, 0);
    ending(openHat, 1, 0, 0);
    ending(rim, 1, 1, 31);
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 24)) ending(block, 1, 0, 0);
    }
    for (const block of hats) {
      if (block === hatPickups) continue;
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 28, pulses: 14, rot: 0, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
    ghostSnare.series = [
      { id: `${ghostSnare.rhythmId}-wait`, steps: 28, pulses: 0, rot: 0, repeats: 1 },
      { id: `${ghostSnare.rhythmId}-pickup`, steps: 4, pulses: 2, rot: 0, repeats: 1 },
    ];
  }
}
