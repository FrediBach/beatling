import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–3 retain the kick, clap and alternating closed/open hats.
// Every added part keeps its routing address throughout the arrangement.
const BASS = 4;
const LEAD = 5;
const COWBELL = 6;
const HAT_PICKUP = 7;
const RIM = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const OPEN_HAT_ACCENT = 14;
const CLOSED_HAT_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: open-hat groove, cowbell lift, closed-hat break, pickup. */
export function refineOpenHatHouse(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 46, tune: 0 });
  Object.assign(voices.clap, { level: 62, decay: 36 });
  Object.assign(voices.ch, { level: 30, decay: 16 });
  Object.assign(voices.oh, { level: 44, decay: 30 });
  Object.assign(voices.cow, { level: 26, decay: 22 });
  Object.assign(voices.rim, { level: 42, decay: 24 });

  // F–A-flat–C–E-flat bass leads the open hats by one sixteenth. A short
  // D/A-flat response supplies the Dorian sixth and space for dotted echoes.
  Object.assign(voices.bassline, { level: 58, decay: 36 });
  Object.assign(voices.bassline.custom, {
    root: 5, scale: 3, octave: 2, waveform: 0, cutoff: 420,
    resonance: 3.2, envelopeAmount: 42, filterDecay: 160, accent: 12,
  });
  Object.assign(voices.lead, { level: 34, decay: 38 });
  Object.assign(voices.lead.custom, {
    root: 5, scale: 3, octave: 3, waveform: 1, pulseMix: 16,
    detune: 5, cutoff: 1900, resonance: 1.8, envelopeAmount: 22, attack: 4, release: 300,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.oh.modulations = [
    { source: `${OPEN_HAT_ACCENT}`, destination: "level", amount: 0.16 },
    { source: `${OPEN_HAT_ACCENT}`, destination: "decay", amount: 0.18 },
  ];
  voices.ch.modulations = [{ source: `${CLOSED_HAT_ACCENT}`, destination: "level", amount: 0.25 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 3, 2, 1);
  const lead = setLane(patch, LEAD, "lead", 0);
  ending(lead, 1, 2, 7);
  const cowbell = setLane(patch, COWBELL, "cow", 0);
  ending(cowbell, 3, 2, 3);
  const hatPickup = setLane(patch, HAT_PICKUP, "ch", 0);
  const rim = setLane(patch, RIM, "rim", 0);
  setLane(patch, BASS_PITCH, "", 1).shape = "ramp";
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { rot: 5, shape: "ramp" });
  Object.assign(setLane(patch, OPEN_HAT_ACCENT, "", 1), { steps: 8, shape: "sqr" });
  Object.assign(setLane(patch, CLOSED_HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });

  const closedHat = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;

  // Leave both hats dry so their envelope contrast stays clear. Filtered
  // studio ambience and dotted-eighth repeats sit behind the clap and lead.
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 20, lowCut: 900, damping: 5000, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 20, lowCut: 1000, tone: 3400, return: 50 });
  effects.sends.clap.reverb = 30;
  effects.sends.cow.reverb = 16;
  effects.sends.rim.reverb = 18;
  effects.sends.lead.reverb = 46;
  effects.sends.lead.delay = 56;

  if (variation === 1) {
    bass.series = [];
    Object.assign(lead, { pulses: 2, rot: 9 });
    ending(lead, 1, 2, 3);
    Object.assign(cowbell, { pulses: 2, rot: 13, series: [] });
    voices.bassline.custom.cutoff = 560;
    voices.lead.custom.cutoff = 2400;
    voices.lead.level = 38;
    voices.oh.decay = 36;
  } else if (variation === 2) {
    // Close the hats while preserving every kick and clap. The reduced
    // bass and longer echoes carry a quieter two-bar response.
    openHat.mute = true;
    closedHat.rot = 14;
    Object.assign(bass, { pulses: 2, series: [] });
    Object.assign(lead, { pulses: 1, rot: 9 });
    ending(lead, 1, 1, 11);
    cowbell.mute = true;
    voices.bassline.custom.cutoff = 280;
    voices.lead.custom.cutoff = 1400;
    effects.sends.lead.delay = 62;
  } else if (variation === 3) {
    // Bar two trades the last open hat for two short closed hits, with a
    // softer final stroke. The bass and lead leave this pickup exposed.
    ending(bass, 1, 1, 1);
    Object.assign(lead, { pulses: 2, rot: 9 });
    ending(lead, 1, 0, 0);
    cowbell.mute = true;
    ending(rim, 1, 1, 13);
    openHat.repeats = 1;
    openHat.series = [
      { id: `${openHat.rhythmId}-short`, steps: 12, pulses: 3, rot: 10, repeats: 1 },
      { id: `${openHat.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    hatPickup.series = [
      { id: `${hatPickup.rhythmId}-wait`, steps: 14, pulses: 0, rot: 0, repeats: 1 },
      { id: `${hatPickup.rhythmId}-pickup`, steps: 2, pulses: 2, rot: 0, repeats: 1 },
    ];
  }
}
