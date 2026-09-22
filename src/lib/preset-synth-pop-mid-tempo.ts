import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–4 retain the 808 kick, snare, clap, eighth-note hats and crash.
const BASS = 5;
const LEAD = 6;
const SHAKER = 7;
const SNARE_PICKUP = 8;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const SNARE_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: major-key hook, fuller lift, clap break, soft snare pickups. */
export function refineSynthPopMidTempo(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 40, tune: -5 });
  Object.assign(voices.snare, { level: 56, decay: 34 });
  Object.assign(voices.clap, { level: 40, decay: 32 });
  Object.assign(voices.ch, { level: 34, decay: 18 });
  Object.assign(voices.cym, { level: 28, decay: 28 });
  Object.assign(voices.shk, { level: 22, decay: 18 });
  for (const id of ["ch", "shk"] as const) {
    voices[id].modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.24 }];
  }
  voices.snare.modulations = [
    { source: `${SNARE_ACCENT}`, destination: "level", amount: 0.3 },
    { source: `${SNARE_ACCENT}`, destination: "decay", amount: 0.2 },
  ];

  // D/A saw bass alternates by bar. The detuned 101 leads with D–F-sharp–A–F-sharp,
  // then E/G above the A bass, leaving space for the filtered dotted echo.
  Object.assign(voices.bassline, { level: 56, decay: 36 });
  Object.assign(voices.bassline.custom, {
    root: 2, scale: 1, octave: 2, waveform: 0, cutoff: 350,
    resonance: 3, envelopeAmount: 32, filterDecay: 180, accent: 12,
  });
  Object.assign(voices.lead, { level: 33, decay: 34 });
  Object.assign(voices.lead.custom, {
    root: 2, scale: 1, octave: 4, waveform: 0, pulseMix: 28, detune: 10,
    cutoff: 2800, resonance: 2.5, envelopeAmount: 30, attack: 5, release: 260,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [{ source: `${LEAD_PITCH}`, destination: "vOct", amount: 7 / 12 }];

  const bass = setLane(patch, BASS, "bassline", 4, 2);
  const lead = setLane(patch, LEAD, "lead", 4, 1);
  ending(lead, 1, 2, 3);
  const shaker = setLane(patch, SHAKER, "shk", 0);
  const snarePickup = setLane(patch, SNARE_PICKUP, "snare", 0);
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  setLane(patch, LEAD_PITCH, "", 1, 1).shape = "tri";
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 4, shape: "sqr" });
  Object.assign(setLane(patch, SNARE_ACCENT, "", 1), { steps: 2, shape: "sqr" });

  const [kick, snare, , hats, cymbal] = patch.blocks;
  cymbal.series = [{ id: `${cymbal.rhythmId}-rest`, steps: 16, pulses: 0, rot: 0, repeats: 3 }];
  // A small parallel drum return supports the backbeat. Filtered studio
  // ambience and lead-only echo keep the low end and hats articulate.
  Object.assign(effects.compressor, { enabled: true, threshold: -22, ratio: 3, attack: 20, release: 160, return: 30 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 24, lowCut: 900, damping: 4500, return: 44 });
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 24, lowCut: 1200, tone: 4200, return: 42 });
  effects.sends.kick.compressor = 30;
  effects.sends.snare.compressor = 32;
  effects.sends.clap.compressor = 24;
  effects.sends.snare.reverb = 22;
  effects.sends.clap.reverb = 24;
  effects.sends.lead.reverb = 38;
  effects.sends.lead.delay = 48;

  if (variation === 1) {
    ending(bass, 1, 8, 1);
    ending(lead, 1, 4, 3);
    Object.assign(shaker, { pulses: 8, rot: 15 });
    cymbal.series[0].repeats = 1;
    voices.bassline.custom.cutoff = 500;
    voices.lead.custom.cutoff = 3600;
    voices.lead.level = 35;
  } else if (variation === 2) {
    kick.pulses = 1;
    snare.mute = true;
    cymbal.mute = true;
    Object.assign(hats, { pulses: 4, rot: 2 });
    bass.pulses = 2;
    ending(bass, 1, 1, 6);
    lead.pulses = 2;
    ending(lead, 1, 1, 7);
    voices.bassline.custom.cutoff = 230;
    Object.assign(voices.lead.custom, { cutoff: 1700, release: 500 });
    effects.sends.lead.delay = 58;
  } else if (variation === 3) {
    // Resolve the lead to D early in bar two. Bass and hats finish before
    // the last backbeat, followed by two shorter, softer snare pickups.
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 2, rot: 6, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    ending(lead, 1, 1, 1);
    voices.lead.custom.release = 360;
    cymbal.series[0].repeats = 1;
    snarePickup.series = [
      { id: `${snarePickup.rhythmId}-wait`, steps: 12, pulses: 0, rot: 0, repeats: 1 },
      { id: `${snarePickup.rhythmId}-pickup`, steps: 4, pulses: 2, rot: 3, repeats: 1 },
    ];
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 12, pulses: 6, rot: 0, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
  }
}
