import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 retain the original layered 808 beat. These fixed addresses are
// shared by all four variations so pitch routing survives song transitions.
const BASS = 6;
const LEAD = 7;
const OPEN_HAT = 8;
const MID_TOM = 9;
const LOW_TOM = 10;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate a newly owned patch: A groove, B lift, C breakdown, D turnaround. */
export function refineElectroBackbeat(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 44, tune: -2 });
  Object.assign(voices.snare, { level: 72, decay: 42 });
  Object.assign(voices.clap, { level: 52, decay: 38 });
  Object.assign(voices.ch, { level: 54, decay: 30 });
  Object.assign(voices.cow, { level: 38, decay: 26 });
  Object.assign(voices.oh, { level: 46, decay: 38 });
  Object.assign(voices.mt, { level: 58, decay: 38 });
  Object.assign(voices.lt, { level: 62, decay: 42 });

  // Short C-minor parts leave space around the snare and the kick's low end.
  Object.assign(voices.bassline, { level: 62, decay: 40 });
  Object.assign(voices.bassline.custom, {
    root: 0, scale: 2, octave: 2, waveform: 1, cutoff: 420,
    resonance: 5.5, envelopeAmount: 48, filterDecay: 180, accent: 16,
  });
  Object.assign(voices.lead, { level: 38, decay: 40 });
  Object.assign(voices.lead.custom, {
    root: 0, scale: 2, octave: 4, waveform: 1, pulseMix: 12,
    detune: 5, cutoff: 1800, resonance: 2, envelopeAmount: 25, attack: 4, release: 230,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 5, 1);
  ending(bass, 3, 7, 1);
  const lead = setLane(patch, LEAD, "lead", 2, 3);
  ending(lead, 1, 0, 0);
  const bassPitch = setLane(patch, BASS_PITCH, "", 1);
  bassPitch.shape = "tri";
  const leadPitch = setLane(patch, LEAD_PITCH, "", 1);
  leadPitch.shape = "ramp";

  // A fourth-bar hat pickup; no extra hits under the initial drum groove.
  const openHat = setLane(patch, OPEN_HAT, "oh", 0);
  ending(openHat, 3, 1, 14);

  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 12, lowCut: 450, damping: 5500, return: 64 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 24, lowCut: 650, tone: 4200, return: 62 });
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 8, tone: 3200, trim: -9, return: 38 });
  effects.sends.snare.reverb = 32;
  effects.sends.clap.reverb = 46;
  effects.sends.mt.reverb = 32;
  effects.sends.lt.reverb = 28;
  effects.sends.lead.reverb = 48;
  effects.sends.lead.delay = 62;
  effects.sends.bassline.distortion = 32;

  if (variation === 1) {
    // Lift the synth phrase and answer with open hats, keeping the backbeat.
    bass.pulses = 7;
    ending(bass, 3, 9, 1);
    lead.pulses = 3;
    ending(lead, 1, 2, 7);
    openHat.pulses = 2;
    openHat.rot = 6;
    ending(openHat, 3, 4, 2);
    voices.bassline.custom.cutoff = 620;
    voices.bassline.custom.envelopeAmount = 58;
    voices.lead.level = 42;
  } else if (variation === 2) {
    // Two-bar breakdown: kick on beats one/three, hats on the offbeats,
    // with the clap and delayed 101 carrying the response.
    const kicks = patch.blocks.filter((block) => block.voice === "kick");
    kicks.forEach((block, index) => {
      block.pulses = index === 0 ? 2 : 0;
      block.rot = 0;
    });
    for (const block of patch.blocks) {
      if (block.voice === "snare" || block.voice === "cow") block.mute = true;
      if (block.voice === "ch") Object.assign(block, { pulses: 4, rot: 2 });
    }
    bass.pulses = 3;
    ending(bass, 1, 2, 2);
    lead.pulses = 2;
    ending(lead, 1, 3, 3);
    openHat.series = [];
    voices.bassline.custom.cutoff = 280;
    effects.sends.lead.delay = 72;
  } else if (variation === 3) {
    // Two-bar turnaround: a descending tom pickup occurs only at the end,
    // while the bass leaves room on the final beat.
    ending(bass, 1, 2, 1);
    ending(lead, 1, 1, 3);
    ending(openHat, 1, 1, 10);
    const midTom = setLane(patch, MID_TOM, "mt", 0);
    ending(midTom, 1, 1, 12);
    const lowTom = setLane(patch, LOW_TOM, "lt", 0);
    ending(lowTom, 1, 1, 14);
    for (const block of patch.blocks) {
      if (block.voice === "ch") ending(block, 1, 16, 0);
    }
  }
}
