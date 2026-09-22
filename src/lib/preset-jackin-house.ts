import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the layered kick, clap, hats and cowbell. Added parts
// and modulation sources keep fixed routing addresses across variations.
const BASS = 6;
const LEAD = 7;
const SHAKER = 8;
const CLAP_PICKUP = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const PERCUSSION_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: syncopated groove, shaker lift, stripped break, cowbell reply. */
export function refineJackinHouse(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 40, tune: 0 });
  Object.assign(voices.clap, { level: 60, decay: 30 });
  Object.assign(voices.ch, { level: 34, decay: 18 });
  Object.assign(voices.oh, { level: 38, decay: 26 });
  Object.assign(voices.cow, { level: 46, decay: 26 });
  Object.assign(voices.shk, { level: 28, decay: 20 });

  // The Dorian bass alternates late sixteenths and offbeats over two bars.
  // Short envelopes leave space around the syncopated kick and A/D stabs.
  Object.assign(voices.bassline, { level: 58, decay: 32 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 3, octave: 2, waveform: 0, cutoff: 440,
    resonance: 3.6, envelopeAmount: 40, filterDecay: 125, accent: 16,
  });
  Object.assign(voices.lead, { level: 36, decay: 28 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 3, octave: 3, waveform: 1, pulseMix: 0,
    detune: 0, cutoff: 2400, resonance: 2.4, envelopeAmount: 32, attack: 2, release: 160,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.2 }];
  voices.shk.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: -0.2 }];
  voices.clap.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.4 }];
  voices.cow.modulations = [{ source: `${PERCUSSION_ACCENT}`, destination: "level", amount: 0.25 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 1, 4, 2);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 0, 0);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  const clapPickup = setLane(patch, CLAP_PICKUP, "clap", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { rot: 15, shape: "ramp" });
  setLane(patch, LEAD_PITCH, "", 1).shape = "sqr";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, PERCUSSION_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const kickPickup = patch.blocks.find((block) => block.voice === "kick" && euclidHit(11, block.steps, block.pulses, block.rot))!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  const cowbell = patch.blocks.find((block) => block.voice === "cow")!;
  ending(openHat, 3, 2, 2);
  ending(cowbell, 3, 1, 6);

  // Parallel compression adds drum weight. A short, filtered sixteenth
  // echo follows the 101 stabs while the cowbell remains rhythmically clear.
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 4, knee: 18, attack: 15, release: 90, makeup: 0, return: 40 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 6, lowCut: 750, damping: 5500, return: 46 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/16", feedback: 14, lowCut: 1000, tone: 4800, return: 44 });
  effects.sends.kick.compressor = 36;
  effects.sends.clap.compressor = 48;
  effects.sends.cow.compressor = 30;
  effects.sends.clap.reverb = 28;
  effects.sends.cow.reverb = 16;
  effects.sends.lead.reverb = 34;
  effects.sends.lead.delay = 58;

  if (variation === 1) {
    ending(lead, 1, 2, 7);
    Object.assign(shaker, { pulses: 8, rot: 15 });
    openHat.series = [];
    cowbell.series = [];
    voices.bassline.custom.cutoff = 620;
    voices.lead.custom.cutoff = 3000;
    voices.lead.level = 40;
  } else if (variation === 2) {
    // Keep the four quarter-note kicks and claps while removing the
    // kick anticipation, open hats and cowbell for a drier response.
    kickPickup.mute = true;
    hats.pulses = 4;
    openHat.mute = true;
    cowbell.mute = true;
    bass.pulses = 2;
    ending(bass, 1, 2, 2);
    lead.pulses = 1;
    ending(lead, 1, 1, 15);
    voices.bassline.custom.cutoff = 300;
    voices.lead.custom.cutoff = 1600;
    effects.sends.lead.delay = 62;
  } else if (variation === 3) {
    // The second bar keeps its four-on-the-floor anchor but clears the
    // last beat for cowbell, softer clap, softer cowbell on steps 13–15.
    ending(kickPickup, 1, 0, 0);
    ending(bass, 1, 1, 2);
    ending(clapPickup, 1, 1, 14);
    cowbell.repeats = 1;
    cowbell.series = [
      { id: `${cowbell.rhythmId}-wait`, steps: 12, pulses: 0, rot: 0, repeats: 1 },
      { id: `${cowbell.rhythmId}-reply`, steps: 4, pulses: 2, rot: 1, repeats: 1 },
    ];
    for (const block of [hats, openHat]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === hats ? 6 : 3, rot: block === hats ? 0 : 10, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
