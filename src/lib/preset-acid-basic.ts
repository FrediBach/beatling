import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–3 preserve the original 909 drums. Pitch and accent sources
// retain fixed addresses as the acid phrase develops across the song.
const BASS = 4;
const LEAD = 5;
const RIM = 6;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const BASS_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: acid groove, brighter lift, filtered break, phrase release. */
export function refineAcidBasic(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 44, tune: 0 });
  Object.assign(voices.clap, { level: 62, decay: 32 });
  Object.assign(voices.ch, { level: 32, decay: 16 });
  Object.assign(voices.oh, { level: 36, decay: 28 });
  Object.assign(voices.rim, { level: 40, decay: 22 });

  // Resonant saw and a wide filter envelope put the 303 in front. Accent
  // routing varies both loudness and envelope length between paired notes.
  Object.assign(voices.bassline, { level: 54, decay: 42 });
  Object.assign(voices.bassline.custom, {
    root: 0, scale: 5, octave: 2, waveform: 0, cutoff: 420,
    resonance: 8.6, envelopeAmount: 68, filterDecay: 145, accent: 32,
  });
  Object.assign(voices.lead, { level: 28, decay: 38 });
  Object.assign(voices.lead.custom, {
    root: 0, scale: 5, octave: 3, waveform: 2, pulseMix: 8,
    detune: 3, cutoff: 1600, resonance: 1.4, envelopeAmount: 18, attack: 12, release: 360,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 1 },
    { source: `${BASS_ACCENT}`, destination: "level", amount: 0.24 },
    { source: `${BASS_ACCENT}`, destination: "decay", amount: 0.22 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.32 }];

  const bass = setLane(patch, BASS, "bassline", 8, 1);
  ending(bass, 3, 7, 1);
  const lead = setLane(patch, LEAD, "lead", 0);
  ending(lead, 1, 2, 3);
  const rim = setLane(patch, RIM, "rim", 0);
  setLane(patch, BASS_PITCH, "", 1).shape = "tri";
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, BASS_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const kick = patch.blocks.find((block) => block.voice === "kick")!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  ending(openHat, 3, 0, 0);

  // A little parallel saturation and high-passed echo extend the acid
  // harmonics. The kick stays dry and the 303 receives no reverb.
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 26, tone: 4500, return: 42 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 20, lowCut: 900, tone: 3800, return: 42 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 750, damping: 4500, return: 46 });
  effects.sends.bassline.distortion = 38;
  effects.sends.bassline.delay = 26;
  effects.sends.clap.reverb = 30;
  effects.sends.rim.reverb = 18;
  effects.sends.lead.reverb = 44;
  effects.sends.lead.delay = 52;

  if (variation === 1) {
    // Open the filter and shorten its decay for the denser fourth bar.
    ending(bass, 3, 12, 0);
    Object.assign(lead, { pulses: 1, rot: 13 });
    ending(lead, 1, 2, 7);
    openHat.series = [];
    voices.bassline.custom.cutoff = 760;
    voices.bassline.custom.resonance = 10.2;
    voices.bassline.custom.envelopeAmount = 78;
    voices.bassline.custom.filterDecay = 125;
    voices.lead.level = 30;
  } else if (variation === 2) {
    // A darker, slower acid phrase carries the two-bar kick break.
    kick.mute = true;
    hats.pulses = 8;
    openHat.mute = true;
    Object.assign(bass, { pulses: 4, series: [] });
    ending(lead, 1, 1, 11);
    voices.bassline.decay = 52;
    voices.bassline.custom.cutoff = 180;
    voices.bassline.custom.resonance = 7;
    voices.bassline.custom.envelopeAmount = 42;
    voices.bassline.custom.filterDecay = 240;
    effects.sends.bassline.delay = 32;
    effects.sends.lead.reverb = 60;
  } else if (variation === 3) {
    // Keep the floor pulse; the second bar releases its final beat to a
    // single 101 answer and rim pickup before the acid loop restarts.
    bass.repeats = 1;
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 12, pulses: 6, rot: 1, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 1, 13);
    ending(rim, 1, 1, 15);
    ending(openHat, 1, 1, 6);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
