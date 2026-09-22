import { createBlock } from "@/lib/patch";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

// Slots 0–3 preserve the original kick, closed hat, rim and open hat.
const BASS = 4;
const LEAD = 5;
const BASS_PITCH = 12;
const LEAD_PITCH = 13;
const HAT_ACCENT = 14;
const PHRASE_ACCENT = 15;

function setLane(patch: Patch, slot: number, voice: VoiceId | "", pulses: number, offset = 0): SequencerBlock {
  const block = { ...createBlock(slot), kind: voice ? "voice" as const : "modulator" as const, voice, pulses, rot: (16 - offset) % 16 };
  patch.blocks[slot] = block;
  return block;
}

function ending(block: SequencerBlock, repeats: number, pulses: number, offset: number) {
  block.repeats = repeats;
  block.series = [{ id: `${block.rhythmId}-ending`, steps: 16, pulses, rot: (16 - offset) % 16, repeats: 1 }];
}

/** Curate an owned patch: sparse dub pulse, restrained lift, echo break, dissolving ending. */
export function refineMinimalDubTechno(patch: Patch, variation: 0 | 1 | 2 | 3): void {
  const { voices, effects } = patch;
  Object.assign(voices.kick, { level: 84, decay: 42, tune: 0 });
  Object.assign(voices.ch, { level: 31, decay: 16 });
  Object.assign(voices.rim, { level: 40, decay: 28 });
  Object.assign(voices.oh, { level: 32, decay: 30 });
  voices.ch.modulations = [{ source: `${HAT_ACCENT}`, destination: "level", amount: 0.3 }];
  voices.rim.modulations = [
    { source: `${PHRASE_ACCENT}`, destination: "level", amount: 0.22 },
    { source: `${PHRASE_ACCENT}`, destination: "decay", amount: 0.12 },
  ];

  // A rounded B/F-sharp foundation stays low and dry. The 101's D and A
  // stabs introduce minor-third/seventh colour across the four-bar phrase.
  Object.assign(voices.bassline, { level: 54, decay: 46 });
  Object.assign(voices.bassline.custom, {
    root: 11, scale: 2, octave: 1, waveform: 1, cutoff: 160,
    resonance: 1.8, envelopeAmount: 16, filterDecay: 320, accent: 8,
  });
  Object.assign(voices.lead, { level: 32, decay: 38 });
  Object.assign(voices.lead.custom, {
    root: 11, scale: 2, octave: 3, waveform: 0, pulseMix: 18, detune: 6,
    cutoff: 1050, resonance: 2.8, envelopeAmount: 28, attack: 5, release: 420,
  });
  voices.bassline.modulations = [{ source: `${BASS_PITCH}`, destination: "vOct", amount: 7 / 12 }];
  voices.lead.modulations = [
    { source: `${LEAD_PITCH}`, destination: "vOct", amount: 1 },
    { source: `${PHRASE_ACCENT}`, destination: "decay", amount: 0.16 },
  ];

  const bass = setLane(patch, BASS, "bassline", 2, 3);
  ending(bass, 3, 1, 3);
  const lead = setLane(patch, LEAD, "lead", 1);
  Object.assign(lead, { steps: 32, rot: 27 });
  lead.series = [{ id: `${lead.rhythmId}-answer`, steps: 32, pulses: 1, rot: 13, repeats: 1 }];
  Object.assign(setLane(patch, BASS_PITCH, "", 1), { steps: 32, rot: 16, shape: "sqr" });
  Object.assign(setLane(patch, LEAD_PITCH, "", 1), { steps: 32, shape: "tri" });
  Object.assign(setLane(patch, HAT_ACCENT, "", 1), { steps: 8, shape: "sqr" });
  Object.assign(setLane(patch, PHRASE_ACCENT, "", 1), { steps: 32, shape: "sqr" });

  const [kick, hats, rim, openHat] = patch.blocks;
  ending(openHat, 3, 0, 0);
  // Dark echoes and high-passed studio ambience fill the rests without
  // sending the kick or bass into the shared tails.
  Object.assign(effects.delay, { enabled: true, sync: true, division: "1/8D", feedback: 42, lowCut: 800, tone: 2500, return: 52 });
  Object.assign(effects.reverb, { enabled: true, space: "studio", preDelay: 24, lowCut: 900, damping: 2800, return: 50 });
  effects.sends.rim.delay = 48;
  effects.sends.rim.reverb = 26;
  effects.sends.lead.delay = 72;
  effects.sends.lead.reverb = 66;

  if (variation === 1) {
    ending(bass, 3, 2, 3);
    lead.pulses = 2;
    Object.assign(lead.series[0], { pulses: 2, rot: 29 });
    ending(rim, 3, 2, 2);
    ending(openHat, 3, 2, 6);
    voices.bassline.custom.cutoff = 230;
    voices.lead.custom.cutoff = 1500;
  } else if (variation === 2) {
    // One bass note and one stab seed a two-bar passage of filtered tails.
    kick.mute = true;
    Object.assign(hats, { pulses: 2, rot: 14 });
    openHat.mute = true;
    bass.pulses = 1;
    ending(bass, 1, 0, 0);
    Object.assign(lead, { steps: 16, pulses: 1, rot: 11 });
    ending(lead, 1, 0, 0);
    voices.bassline.custom.cutoff = 120;
    voices.lead.custom.cutoff = 700;
    voices.lead.custom.envelopeAmount = 18;
    voices.lead.custom.release = 600;
    effects.delay.feedback = 48;
    effects.delay.tone = 1900;
    effects.sends.lead.reverb = 74;
  } else if (variation === 3) {
    // An early stab and a late rim echo carry the ending; leave the final
    // kick out and let the returns bridge the space before the next A.
    bass.repeats = 1;
    bass.series = [
      { id: `${bass.rhythmId}-short`, steps: 8, pulses: 1, rot: 5, repeats: 1 },
      { id: `${bass.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    Object.assign(lead, { steps: 16, pulses: 1, rot: 11 });
    ending(lead, 1, 0, 0);
    ending(rim, 1, 1, 7);
    ending(openHat, 1, 0, 0);
    kick.series = [
      { id: `${kick.rhythmId}-short`, steps: 12, pulses: 3, rot: 0, repeats: 1 },
      { id: `${kick.rhythmId}-rest`, steps: 4, pulses: 0, rot: 0, repeats: 1 },
    ];
    hats.series = [
      { id: `${hats.rhythmId}-short`, steps: 8, pulses: 2, rot: 6, repeats: 1 },
      { id: `${hats.rhythmId}-rest`, steps: 8, pulses: 0, rot: 0, repeats: 1 },
    ];
    effects.delay.feedback = 46;
  }
}
