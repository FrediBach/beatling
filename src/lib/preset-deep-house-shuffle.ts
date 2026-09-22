import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–4 retain the kick, clap, shuffled closed hats, open hats and rim.
// Synths and modulation sources keep fixed addresses across the song.
const BASS = 5;
const LEAD = 6;
const CLAP_PICKUP = 7;
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

/** Curate an owned patch: minor shuffle, melodic lift, rim break, clap pickup. */
export function refineDeepHouseShuffle(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 44, tune: 0 });
  Object.assign(voices.clap, { level: 58, decay: 40 });
  Object.assign(voices.ch, { level: 34, decay: 18 });
  Object.assign(voices.oh, { level: 36, decay: 26 });
  Object.assign(voices.rim, { level: 38, decay: 26 });

  // A rounded E-minor bass climbs across two bars. The slower triangle
  // lead moves G–F-sharp, adding a ninth over the returning E bass.
  Object.assign(voices.bassline, { level: 58, decay: 44 });
  Object.assign(voices.bassline.custom, {
    root: 4, scale: 2, octave: 2, waveform: 1, cutoff: 200,
    resonance: 1.6, envelopeAmount: 18, filterDecay: 300, accent: 8,
  });
  Object.assign(voices.lead, { level: 34, decay: 48 });
  Object.assign(voices.lead.custom, {
    root: 4, scale: 2, octave: 3, waveform: 2, pulseMix: 12,
    detune: 5, cutoff: 1300, resonance: 1.3, envelopeAmount: 14, attack: 28, release: 900,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.36 }];
  voices.clap.modulations = [{ source: `${CLAP_ACCENT}`, destination: "level", amount: 0.35 }];

  const bass = setLane(patch, BASS, "bassline", 2, 3);
  ending(bass, 1, 4, 1);
  const lead = setLane(patch, LEAD, "lead", 1, 5);
  ending(lead, 1, 1, 13);
  const clapPickup = setLane(patch, CLAP_PICKUP, "clap", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 29, shape: "ramp" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, shape: "tri" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, CLAP_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const kick = patch.blocks.find((block) => block.voice === "kick")!;
  const clap = patch.blocks.find((block) => block.voice === "clap")!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  const rim = patch.blocks.find((block) => block.voice === "rim")!;
  // Thin the fourth-bar percussion around the late sustained lead note.
  ending(openHat, 3, 2, 6);
  ending(rim, 3, 1, 7);

  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 28, lowCut: 650, damping: 3400, return: 48 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/4", feedback: 24, lowCut: 750, tone: 2500, return: 48 });
  effects.sends.clap.reverb = 24;
  effects.sends.rim.reverb = 22;
  effects.sends.lead.reverb = 64;
  effects.sends.lead.delay = 50;

  if (variation === 1) {
    bass.pulses = 4;
    lead.pulses = 2;
    ending(lead, 1, 1, 9);
    Object.assign(rim, { pulses: 4, rot: 13, series: [] });
    openHat.series = [];
    voices.bassline.custom.cutoff = 280;
    voices.lead.custom.cutoff = 1700;
    voices.lead.level = 38;
  } else if (variation === 2) {
    // Half-density kicks and a rim backbeat open up the two-bar melody.
    kick.pulses = 2;
    clap.mute = true;
    Object.assign(rim, { pulses: 2, rot: 12, series: [] });
    Object.assign(hats, { pulses: 4, rot: 14 });
    openHat.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 1, 9);
    voices.bassline.custom.cutoff = 160;
    voices.lead.custom.cutoff = 1000;
    effects.sends.lead.reverb = 72;
    effects.sends.lead.delay = 60;
  } else if (variation === 3) {
    // Bar two leaves the final kick and hats out. A rim and softer clap
    // pickup carry the last beat while the long melodic tail fades.
    ending(bass, 1, 2, 1);
    ending(lead, 1, 0, 0);
    ending(rim, 1, 1, 13);
    ending(clapPickup, 1, 1, 15);
    for (const block of [kick, hats, openHat]) {
      block.repeats = 1;
      block.series = [
        { id: `${block.rhythmId}-short`, steps: 12, pulses: block === hats ? 9 : 3, rot: block === openHat ? 10 : 0, repeats: 1 },
        { id: `${block.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
      ];
    }
  }
}
