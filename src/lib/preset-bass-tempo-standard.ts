import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// The original layered drums occupy slots 0–6. Keep the added voices and
// modulation sources at stable addresses across the four song sections.
const BASS = 7;
const LEAD = 8;
const SNARE = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const ROLL_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: bass groove, bright lift, kick dropout, snare roll. */
export function refineBassTempoStandard(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 90, decay: 78, tune: -2 });
  Object.assign(voices.clap, { level: 72, decay: 34 });
  Object.assign(voices.ch, { level: 44, decay: 20 });
  Object.assign(voices.oh, { level: 42, decay: 28 });
  Object.assign(voices.cow, { level: 32, decay: 22 });
  Object.assign(voices.snare, { level: 60, decay: 26 });

  // The long 808 owns the sub register. The 303 sits above it with a short
  // envelope, placing the main riff between the original kick attacks.
  Object.assign(voices.bassline, { level: 54, decay: 30 });
  Object.assign(voices.bassline.custom, {
    root: 5, scale: 2, octave: 2, waveform: 0, cutoff: 480,
    resonance: 4.2, envelopeAmount: 54, filterDecay: 125, accent: 18,
  });
  Object.assign(voices.lead, { level: 40, decay: 30 });
  Object.assign(voices.lead.custom, {
    root: 5, scale: 2, octave: 4, waveform: 1, pulseMix: 8,
    detune: 3, cutoff: 2600, resonance: 2.4, envelopeAmount: 28, attack: 3, release: 180,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.28 }];
  voices.snare.modulations = [{ source: `${ROLL_ACCENT}`, destination: "level", amount: 0.35 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 3, 4, 3);
  const lead = setLane(patch, LEAD, "lead", 1, 8);
  ending(lead, 1, 2, 3);
  const snare = setLane(patch, SNARE, "snare", 0);
  setLane(patch, BASS_PITCH, "", 1).shape = "tri";
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  const hatAccent = setLane(patch, HAT_ACCENT, "", 1);
  hatAccent.steps = 2;
  hatAccent.shape = "sqr";
  const rollAccent = setLane(patch, ROLL_ACCENT, "", 1);
  rollAccent.steps = 4;
  rollAccent.shape = "ramp";

  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  const cowbell = patch.blocks.find((block) => block.voice === "cow")!;
  ending(hats, 3, 8, 0);
  ending(cowbell, 3, 2, 2);

  // Dry kick and hats keep the fast groove clear; only the synth phrase
  // feeds the echo, with a little parallel grit on the short bass notes.
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 650, damping: 5600, return: 60 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 20, lowCut: 900, tone: 4600, return: 56 });
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 10, tone: 3600, trim: -10, return: 40 });
  effects.sends.clap.reverb = 40;
  effects.sends.snare.reverb = 26;
  effects.sends.lead.reverb = 44;
  effects.sends.lead.delay = 60;
  effects.sends.bassline.distortion = 34;

  if (variation === 1) {
    // Retain the kick/clap hook and increase the melodic and hat activity.
    bass.pulses = 6;
    ending(bass, 3, 8, 1);
    lead.pulses = 2;
    lead.rot = 13;
    ending(lead, 1, 3, 3);
    hats.series = [];
    cowbell.series = [];
    ending(openHat, 3, 2, 6);
    voices.bassline.custom.cutoff = 660;
    voices.lead.level = 44;
  } else if (variation === 2) {
    // One bar without the kick, then its full syncopated pattern returns.
    // Each layered component preserves its own original rhythm in bar two.
    for (const block of patch.blocks) {
      if (block.voice !== "kick") continue;
      block.series = [{ id: `${block.rhythmId}-return`, steps: block.steps, pulses: block.pulses, rot: block.rot, repeats: 1 }];
      block.repeats = 1;
      block.pulses = 0;
    }
    hats.pulses = 8;
    hats.rot = 1;
    hats.series = [];
    hatAccent.steps = 4;
    cowbell.mute = true;
    openHat.mute = true;
    bass.pulses = 2;
    ending(bass, 1, 4, 3);
    lead.pulses = 2;
    lead.rot = 13;
    ending(lead, 1, 1, 7);
    voices.bassline.custom.cutoff = 320;
    effects.sends.lead.delay = 68;
  } else if (variation === 3) {
    // In bar two, clear the last beat for four rising snare hits. The kick
    // and clap stay in place to carry the roll back into the main groove.
    ending(bass, 1, 2, 1);
    ending(lead, 1, 0, 0);
    ending(cowbell, 1, 1, 2);
    ending(openHat, 1, 0, 0);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    snare.series = [
      { id: `${snare.rhythmId}-wait`, steps: 12, pulses: 0, rot: 0, repeats: 1 },
      { id: `${snare.rhythmId}-roll`, steps: 4, pulses: 4, rot: 0, repeats: 1 },
    ];
  }
}
