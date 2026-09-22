import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the layered kicks, clap, hats and two low-tom hits.
// Added parts use fixed addresses so their routes survive song transitions.
const BASS = 6;
const LEAD = 7;
const RIM = 8;
const MID_TOM = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const TOM_ACCENT = 14;

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

/** Curate an owned patch: sparse ballad, gentle lift, rim break, tom return. */
export function refineSparse808Ballad(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 82, tune: 2 });
  Object.assign(voices.clap, { level: 60, decay: 42 });
  Object.assign(voices.ch, { level: 34, decay: 24 });
  Object.assign(voices.lt, { level: 48, decay: 40, tune: -2 });
  Object.assign(voices.mt, { level: 42, decay: 36 });
  Object.assign(voices.rim, { level: 44, decay: 28 });

  // The 303 alternates A and E above the long 808 tail. A slower triangle
  // lead answers in A major with an audible attack and room to decay.
  Object.assign(voices.bassline, { level: 52, decay: 48 });
  Object.assign(voices.bassline.custom, {
    root: 9, scale: 1, octave: 2, waveform: 1, cutoff: 220,
    resonance: 1.8, envelopeAmount: 18, filterDecay: 420, accent: 8,
  });
  Object.assign(voices.lead, { level: 34, decay: 52 });
  Object.assign(voices.lead.custom, {
    root: 9, scale: 1, octave: 3, waveform: 2, pulseMix: 10,
    detune: 5, cutoff: 1400, resonance: 1.4, envelopeAmount: 16, attack: 65, release: 1100,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lt.modulations = [{ source: `${TOM_ACCENT}`, destination: "level", amount: 0.3 }];

  const bass = setLane(patch, BASS, "bassline", 1, 1);
  ending(bass, 1, 1, 9);
  const lead = setLane(patch, LEAD, "lead", 1, 5);
  ending(lead, 1, 1, 13);
  const rim = setLane(patch, RIM, "rim", 0);
  const midTom = setLane(patch, MID_TOM, "mt", 0);
  const bassPitch = setLane(patch, BASS_PITCH, "", 1);
  Object.assign(bassPitch, { steps: 32, rot: 16, shape: "sqr" });
  const leadPitch = setLane(patch, LEAD_PITCH, "", 1);
  Object.assign(leadPitch, { steps: 32, shape: "ramp" });
  const tomAccent = setLane(patch, TOM_ACCENT, "", 1);
  Object.assign(tomAccent, { steps: 2, shape: "sqr" });

  const clap = patch.blocks.find((block) => block.voice === "clap")!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const lowToms = patch.blocks.filter((block) => block.voice === "lt");
  // Preserve the first bar's tom pair; leave bar two to the later 101 note.
  for (const block of lowToms) ending(block, 1, 0, 0);

  // High-pass the longer tails and keep all kick/bass sends silent so the
  // sustained low end remains distinct from the melodic atmosphere.
  Object.assign(effects.reverb, { enabled: true, space: "hall", preDelay: 35, lowCut: 750, damping: 3500, return: 48 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/2", feedback: 18, lowCut: 900, tone: 2600, return: 52 });
  effects.sends.clap.reverb = 22;
  effects.sends.lt.reverb = 26;
  effects.sends.mt.reverb = 28;
  effects.sends.rim.reverb = 24;
  effects.sends.lead.reverb = 64;
  effects.sends.lead.delay = 46;

  if (variation === 1) {
    // Add a second bass note and an early melodic answer, keeping the
    // sparse kick/clap framework and four offbeat hats.
    bass.pulses = 2;
    ending(bass, 1, 2, 5);
    lead.pulses = 2;
    ending(lead, 1, 1, 9);
    for (const block of lowToms) block.series = [];
    ending(rim, 3, 1, 11);
    voices.bassline.custom.cutoff = 300;
    voices.lead.custom.cutoff = 1800;
    voices.lead.level = 38;
  } else if (variation === 2) {
    // Substitute a quiet rim backbeat for the clap and remove the late kick
    // and tom pair. Two hats per bar keep the response gently moving.
    for (const block of patch.blocks) {
      if (block.voice === "kick" && hitsAt(block, 10)) block.mute = true;
    }
    clap.mute = true;
    Object.assign(rim, { pulses: 2, rot: 12 });
    Object.assign(hats, { pulses: 2, rot: 10 });
    for (const block of lowToms) block.mute = true;
    voices.lead.custom.cutoff = 1100;
    voices.lead.custom.attack = 90;
    effects.sends.lead.reverb = 72;
    effects.sends.lead.delay = 54;
  } else if (variation === 3) {
    // The last bar makes space for a quiet mid-to-low tom pickup. The second
    // low-tom hit remains softer, carrying the groove back to its downbeat.
    ending(bass, 1, 1, 1);
    ending(lead, 1, 0, 0);
    ending(midTom, 1, 1, 14);
    for (const block of lowToms) ending(block, 1, hitsAt(block, 15) ? 1 : 0, 15);
    hats.repeats = 1;
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 3, rot: 10, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
