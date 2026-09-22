import { clamp, euclidHit } from "@/lib/euclid";
import { sampleLfo, type LfoFrame } from "@/lib/lfo";
import { effectiveVoiceModulation } from "@/lib/modulation";
import { quantizeVoiceCv } from "@/lib/quantizer";
import { rhythmsFor } from "@/lib/rhythm-series";
import type { Patch, VoiceId } from "@/lib/types";
import { hasSoloedVoices, isVoiceAudible } from "@/lib/voice-audibility";
import { simpleClock } from "./constraints";
import type { MusicalRequest } from "./types";

export interface MusicalEvent { slot: number; voice: VoiceId; pulse: number; midi?: number }

// Bounded model of direct, division-one lanes. Traversal order, previous clock
// interval, startup and swing match the engine; complex routes are not predicted.
export function musicalEvents(patch: Patch, bars = 4): MusicalEvent[] {
  const frames = new Map<number, LfoFrame>();
  const events: MusicalEvent[] = [];
  const interval = 60 / patch.bpm / patch.rate;
  const soloActive = hasSoloedVoices(patch.voices);
  const cycles = patch.blocks.map((block) => rhythmsFor(block).flatMap((rhythm) =>
    Array.from({ length: rhythm.repeats }, () => rhythm)));
  for (let pulse = 0; pulse < Math.min(bars, 8) * patch.rate * 4; pulse++) {
    const time = pulse * interval + (pulse % 2 ? patch.swing / 100 * interval * 0.5 : 0);
    patch.blocks.forEach((block, slot) => {
      if (!simpleClock(block)) return;
      const cycle = cycles[slot];
      let position = pulse % cycle.reduce((sum, rhythm) => sum + rhythm.steps, 0);
      let rhythm = cycle[0];
      for (const next of cycle) {
        rhythm = next;
        if (position < rhythm.steps) break;
        position -= rhythm.steps;
      }
      const previous = frames.get(slot);
      frames.set(slot, { time, position, stepDuration: previous ? Math.max(0.008, time - previous.time) : interval, rhythm, shape: block.shape, random: 0.5, euclidean: block.kind !== "voice" });
      if (block.kind !== "voice" || !block.voice || block.mute || !isVoiceAudible(patch.voices, block.voice, soloActive) || patch.voices[block.voice].level === 0 || block.prob === 0 || !euclidHit(position, rhythm.steps, rhythm.pulses, rhythm.rot)) return;
      const event: MusicalEvent = { slot, voice: block.voice, pulse };
      if (block.voice === "bassline" || block.voice === "lead") {
        const voice = patch.voices[block.voice];
        const modulation = effectiveVoiceModulation(voice, (source) => {
          const frame = frames.get(source);
          return frame ? sampleLfo(frame, time).value : 0.5;
        });
        event.midi = quantizeVoiceCv(voice.custom, modulation.vOct, clamp(voice.tune + modulation.tune * 12, -24, 24)).midi;
      }
      events.push(event);
    });
  }
  return events;
}

export function candidateScore(patch: Patch, source: Patch, request: MusicalRequest): number {
  const events = musicalEvents(patch);
  const byVoice = new Map<VoiceId, MusicalEvent[]>();
  const occupied = new Map<number, number>();
  let penalty = 0;
  const seen = new Set<string>();
  for (const event of events) {
    const key = `${event.voice}:${event.pulse}`;
    if (seen.has(key)) penalty += 12;
    seen.add(key);
    occupied.set(event.pulse, (occupied.get(event.pulse) ?? 0) + 1);
    const group = byVoice.get(event.voice) ?? [];
    group.push(event);
    byVoice.set(event.voice, group);
  }
  for (const count of occupied.values()) penalty += Math.max(0, count - 4) * 2;
  const bass = new Set((byVoice.get("bassline") ?? []).map((event) => event.pulse));
  for (const note of byVoice.get("lead") ?? []) if (bass.has(note.pulse)) penalty += 1.5;
  const hats = new Set((byVoice.get("ch") ?? []).map((event) => event.pulse));
  for (const event of byVoice.get("oh") ?? []) if (hats.has(event.pulse)) penalty += 4;
  for (const event of byVoice.get("shk") ?? []) if (hats.has(event.pulse)) penalty += 0.5;
  for (const voice of ["bassline", "lead"] as const) {
    const notes = byVoice.get(voice) ?? [];
    for (let index = 1; index < notes.length; index++) penalty += Math.max(0, Math.abs(notes[index].midi! - notes[index - 1].midi!) - 7);
  }
  if (request.mode === "reshape") {
    const original = new Set(musicalEvents(source).map((event) => `${event.voice}:${event.pulse}`));
    const difference = [...seen].filter((key) => !original.has(key)).length + [...original].filter((key) => !seen.has(key)).length;
    const target = [0.12, 0.3, 0.6][request.change];
    penalty += Math.abs(difference / Math.max(1, original.size) - target) * 16;
  }
  return 1 / (1 + penalty);
}
