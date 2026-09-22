import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// The original drum components occupy slots 0–7. Keep these added voice and
// modulation addresses stable throughout the song.
const BASS = 8;
const LEAD = 9;
const RIM = 10;
const HIGH_TOM = 11;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const MARACA_ACCENT = 14;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: maraca groove, percussion lift, break, turnaround. */
export function refineElectroFunkMaracas(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 86, decay: 38, tune: -1 });
  Object.assign(voices.clap, { level: 70, decay: 36 });
  Object.assign(voices.shk, { level: 46, decay: 30 });
  Object.assign(voices.cow, { level: 40, decay: 28 });
  Object.assign(voices.mt, { level: 54, decay: 34 });
  Object.assign(voices.lt, { level: 58, decay: 38 });
  Object.assign(voices.ht, { level: 52, decay: 30 });
  Object.assign(voices.rim, { level: 44, decay: 32 });

  // A plucked saw bass and a rounded 101 response share D minor pentatonic.
  Object.assign(voices.bassline, { level: 62, decay: 38 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 5, octave: 2, waveform: 0, cutoff: 360,
    resonance: 3.8, envelopeAmount: 62, filterDecay: 145, accent: 20,
  });
  Object.assign(voices.lead, { level: 40, decay: 38 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 5, octave: 3, waveform: 2, pulseMix: 22,
    detune: 4, cutoff: 2200, resonance: 2.2, envelopeAmount: 32, attack: 3, release: 260,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 1 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 }];
  voices.shk.modulations = [{ source: `${MARACA_ACCENT}`, destination: "level", amount: 0.3 }];

  const bass = setLane(patch, BASS, "bassline", 4, 1);
  ending(bass, 3, 5, 1);
  const lead = setLane(patch, LEAD, "lead", 0);
  ending(lead, 1, 2, 3);
  const rim = setLane(patch, RIM, "rim", 0);
  const highTom = setLane(patch, HIGH_TOM, "ht", 0);
  setLane(patch, BASS_PITCH, "", 1).shape = "tri";
  setLane(patch, LEAD_PITCH, "", 1).shape = "ramp";
  const accent = setLane(patch, MARACA_ACCENT, "", 1);
  accent.steps = 2;
  accent.shape = "sqr";

  const midTom = patch.blocks.find((block) => block.voice === "mt")!;
  const lowTom = patch.blocks.find((block) => block.voice === "lt")!;
  const maracas = patch.blocks.find((block) => block.voice === "shk")!;
  ending(midTom, 3, 4, 2);
  ending(lowTom, 3, 4, 3);

  // Keep the sixteenth-note maracas and low end dry; give the toms a small
  // room and let only the melodic answer and cowbell feed the eighth echo.
  Object.assign(effects.reverb, { enabled: true, space: "room", preDelay: 10, lowCut: 500, damping: 4800, return: 62 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8", feedback: 22, lowCut: 700, tone: 3800, return: 60 });
  effects.sends.clap.reverb = 42;
  effects.sends.mt.reverb = 36;
  effects.sends.lt.reverb = 32;
  effects.sends.ht.reverb = 34;
  effects.sends.rim.reverb = 24;
  effects.sends.lead.reverb = 48;
  effects.sends.lead.delay = 58;
  effects.sends.cow.delay = 24;

  if (variation === 1) {
    // Answer the toms with rim clicks and a busier, brighter bass phrase.
    bass.pulses = 5;
    ending(bass, 3, 7, 1);
    lead.pulses = 1;
    lead.rot = 13; // Step 3.
    ending(lead, 1, 3, 3);
    rim.pulses = 2;
    rim.rot = 13; // Steps 3 and 11.
    ending(rim, 3, 4, 3);
    voices.bassline.custom.cutoff = 520;
    voices.lead.level = 44;
  } else if (variation === 2) {
    // Keep clap and paired toms as the anchor of a lighter two-bar break.
    const kicks = patch.blocks.filter((block) => block.voice === "kick");
    kicks.forEach((block, index) => {
      block.pulses = index === 0 ? 2 : 0;
      block.rot = 0;
    });
    maracas.pulses = 8;
    accent.steps = 4;
    for (const block of patch.blocks) {
      if (block.voice === "cow") block.mute = true;
    }
    bass.pulses = 2;
    ending(bass, 1, 3, 1);
    ending(midTom, 1, 2, 6);
    ending(lowTom, 1, 2, 7);
    voices.bassline.custom.cutoff = 260;
    effects.sends.lead.delay = 68;
  } else if (variation === 3) {
    // On the last beat of bar two, the maracas and synths leave space for
    // high tom → mid tom → rim → low tom. No extra fill hits in bar one.
    ending(bass, 1, 2, 1);
    lead.pulses = 2;
    lead.rot = 13;
    ending(lead, 1, 0, 0);
    ending(highTom, 1, 1, 12);
    ending(midTom, 1, 1, 13);
    ending(rim, 1, 1, 14);
    ending(lowTom, 1, 1, 15);
    maracas.repeats = 1;
    maracas.series = [
      { id: `${maracas.rhythmId}-pickup`, steps: 12, pulses: 12, rot: 0, repeats: 1 },
      { id: `${maracas.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
