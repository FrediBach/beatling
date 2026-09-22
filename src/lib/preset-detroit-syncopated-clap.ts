import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the kick, two clap components, hats and cymbal.
const BASS = 6;
const LEAD = 7;
const MID_TOM = 8;
const LOW_TOM = 9;
const CLAP_PICKUP = 10;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const CLAP_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: melodic groove, brighter lift, backbeat break, tom/clap ending. */
export function refineDetroitSyncopatedClap(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 40, tune: 0 });
  Object.assign(voices.clap, { level: 64, decay: 35 });
  Object.assign(voices.ch, { level: 32, decay: 16 });
  Object.assign(voices.oh, { level: 35, decay: 26 });
  // The continuous 909 cymbal is a quiet moving texture above the hats.
  Object.assign(voices.cym, { level: 18, decay: 8 });
  Object.assign(voices.mt, { level: 52, decay: 24, tune: 3 });
  Object.assign(voices.lt, { level: 54, decay: 24, tune: 3 });
  voices.clap.modulations = [
    { source: `${CLAP_ACCENT}`, destination: "level", amount: 0.4 },
    { source: `${CLAP_ACCENT}`, destination: "decay", amount: 0.2 },
  ];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.22 }];
  voices.cym.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: -0.38 }];

  // A rounded A-Dorian 303 supports a higher, lightly detuned 101 line.
  // Low resonance keeps the syncopated clap ahead of the bass harmonics.
  Object.assign(voices.bassline, { level: 57, decay: 38 });
  Object.assign(voices.bassline.custom, {
    root: 9, scale: 3, octave: 2, waveform: 1, cutoff: 280,
    resonance: 2.6, envelopeAmount: 28, filterDecay: 190, accent: 14,
  });
  Object.assign(voices.lead, { level: 32, decay: 34 });
  Object.assign(voices.lead.custom, {
    root: 9, scale: 3, octave: 3, waveform: 0, pulseMix: 20, detune: 7,
    cutoff: 2600, resonance: 2.2, envelopeAmount: 22, attack: 6, release: 280,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 1 },
    { source: `${CLAP_ACCENT}`, destination: "level", amount: 0.14 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 3, 1);
  ending(bass, 1, 4, 3);
  const lead = setLane(patch, LEAD, "lead", 3, 2);
  ending(lead, 1, 2, 6);
  const midTom = setLane(patch, MID_TOM, "mt", 0);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  const clapPickup = setLane(patch, CLAP_PICKUP, "clap", 0);
  setLane(patch, BASS_PITCH, "", 1, 1).shape = "ramp";
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, shape: "tri" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, CLAP_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const kick = patch.blocks.find((block) => block.voice === "kick")!;
  const ghostClap = patch.blocks.find((block) => block.voice === "clap" && euclidHit(7, block.steps, block.pulses, block.rot))!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  const cymbal = patch.blocks.find((block) => block.voice === "cym")!;
  ending(cymbal, 3, 8, 0);

  // The clap gets room ambience and parallel weight, with no echo to
  // blur its anticipation. Only the melodic line feeds the eighth delay.
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 12, lowCut: 700, damping: 4800, return: 48 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 22, lowCut: 900, tone: 4400, return: 46 });
  Object.assign(effects.compressor, { enabled: true, threshold: -24, ratio: 3, knee: 18, attack: 18, release: 110, makeup: 0, return: 38 });
  effects.sends.kick.compressor = 26;
  effects.sends.clap.compressor = 48;
  effects.sends.clap.reverb = 34;
  effects.sends.mt.reverb = 24;
  effects.sends.lt.reverb = 20;
  effects.sends.lead.reverb = 46;
  effects.sends.lead.delay = 58;

  if (variation === 1) {
    bass.pulses = 4;
    lead.pulses = 4;
    ending(lead, 1, 3, 2);
    cymbal.series = [];
    voices.bassline.custom.cutoff = 420;
    voices.lead.custom.cutoff = 3200;
    voices.lead.level = 35;
  } else if (variation === 2) {
    // Expose the regular backbeat and longer 101 notes over half-density
    // kicks, clearing the extra clap, open hats and cymbal wash.
    kick.pulses = 2;
    ghostClap.mute = true;
    hats.pulses = 4;
    openHat.mute = true;
    cymbal.mute = true;
    bass.pulses = 2;
    ending(bass, 1, 2, 3);
    lead.pulses = 1;
    ending(lead, 1, 1, 6);
    voices.bassline.custom.cutoff = 180;
    voices.lead.custom.cutoff = 1300;
    voices.lead.custom.release = 500;
    effects.sends.lead.reverb = 60;
  } else if (variation === 3) {
    // Leave the final half-bar free of new synth notes. The backbeat
    // leads into E/A toms and a softer clap pickup on the last sixteenth.
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 2, rot: 5, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 1, 2);
    ending(midTom, 1, 1, 13);
    ending(lowTom, 1, 1, 14);
    ending(clapPickup, 1, 1, 15);
    for (const block of [hats, openHat, cymbal]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === hats ? 6 : block === openHat ? 3 : 12, rot: block === openHat ? 10 : 0, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
