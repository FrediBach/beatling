import { euclidHit } from "@/lib/euclid";
import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–5 preserve the three kick components, hats and half-time clap.
const BASS = 6;
const LEAD = 7;
const RIM = 8;
const LOW_TOM = 9;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const NOTE_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: displaced kick groove, busier lift, sparse break, kick/tom/rim ending. */
export function refineOffbeatKickTechno(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 88, decay: 30, tune: 4 });
  Object.assign(voices.ch, { level: 31, decay: 14 });
  Object.assign(voices.oh, { level: 36, decay: 24 });
  Object.assign(voices.clap, { level: 61, decay: 30 });
  Object.assign(voices.rim, { level: 42, decay: 20 });
  Object.assign(voices.lt, { level: 48, decay: 20, tune: 6 });
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.32 }];
  voices.rim.modulations = [{ source: `${NOTE_ACCENT}`, destination: "level", amount: 0.25 }];

  // Short C-minor square notes fit between the kick attacks, including
  // the displaced hit on step 10. The saw 101 answers with E-flat/B-flat.
  Object.assign(voices.bassline, { level: 54, decay: 26 });
  Object.assign(voices.bassline.custom, {
    root: 0, scale: 5, octave: 2, waveform: 1, cutoff: 430,
    resonance: 6, envelopeAmount: 52, filterDecay: 95, accent: 24,
  });
  Object.assign(voices.lead, { level: 29, decay: 30 });
  Object.assign(voices.lead.custom, {
    root: 0, scale: 5, octave: 3, waveform: 0, pulseMix: 16, detune: 5,
    cutoff: 2400, resonance: 2.2, envelopeAmount: 26, attack: 4, release: 190,
  });
  voices.bassline.modulations = [
    { source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 },
    { source: `${NOTE_ACCENT}`, destination: "level", amount: 0.22 },
    { source: `${NOTE_ACCENT}`, destination: "decay", amount: 0.12 },
  ];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 1, 3, 3);
  const lead = setLane(patch, LEAD, "lead", 1, 7);
  ending(lead, 1, 1, 15);
  const rim = setLane(patch, RIM, "rim", 0);
  ending(rim, 3, 1, 15);
  const lowTom = setLane(patch, LOW_TOM, "lt", 0);
  setLane(patch, BASS_PITCH, "", 1, 1).shape = "tri";
  setLane(patch, LEAD_PITCH, "", 1, 3).shape = "ramp";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 2, shape: "sqr" });
  Object.assign(setLane(patch, NOTE_ACCENT, "", 1), { steps: 4, shape: "sqr" });

  const backbeatKicks = patch.blocks.find((block) => block.voice === "kick" && euclidHit(4, block.steps, block.pulses, block.rot))!;
  const hats = patch.blocks.find((block) => block.voice === "ch")!;
  const openHat = patch.blocks.find((block) => block.voice === "oh")!;
  ending(openHat, 3, 1, 6);
  Object.assign(effects.distortion, { enabled: true, mode: "soft", drive: 32, tone: 3800, return: 38 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 22, lowCut: 1000, tone: 3400, return: 42 });
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 8, lowCut: 800, damping: 4200, return: 44 });
  effects.sends.kick.distortion = 18;
  effects.sends.bassline.distortion = 42;
  effects.sends.clap.reverb = 30;
  effects.sends.rim.reverb = 18;
  effects.sends.lt.reverb = 22;
  effects.sends.lead.reverb = 36;
  effects.sends.lead.delay = 50;

  if (variation === 1) {
    bass.pulses = 8;
    ending(bass, 1, 4, 1);
    lead.pulses = 2;
    ending(lead, 1, 2, 3);
    ending(rim, 3, 2, 7);
    ending(openHat, 3, 4, 2);
    Object.assign(voices.bassline.custom, { cutoff: 720, resonance: 7.2, envelopeAmount: 64 });
    voices.lead.custom.cutoff = 3000;
  } else if (variation === 2) {
    // Keep the downbeat and displaced kick; remove the beats-two/four
    // component so the two remaining kick hits retain the preset's shape.
    backbeatKicks.mute = true;
    hats.pulses = 8;
    openHat.mute = true;
    rim.mute = true;
    bass.pulses = 2;
    ending(bass, 1, 1, 3);
    ending(lead, 1, 0, 0);
    voices.bassline.custom.cutoff = 260;
    voices.bassline.custom.envelopeAmount = 34;
    voices.lead.custom.cutoff = 1200;
    voices.lead.custom.release = 420;
    effects.sends.bassline.distortion = 28;
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Preserve every kick, including step 26. Release the synth phrase
    // early, then answer the last kick with a C tom and a soft rim pickup.
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 1, rot: 5, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 0, 0);
    ending(lowTom, 1, 1, 13);
    ending(rim, 1, 1, 15);
    ending(openHat, 1, 1, 6);
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
