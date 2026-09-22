import { euclidHit } from "@/lib/euclid";
import { quantizeVoiceCv } from "@/lib/quantizer";
import { hasSoloedVoices, isVoiceAudible } from "@/lib/voice-audibility";
import { rhythmsFor } from "@/lib/rhythm-series";
import type { Patch, SequencerBlock, VoiceId } from "@/lib/types";

const PPQ = 480;
const MAX_BARS = 64;
const DRUM_NOTES: Partial<Record<VoiceId, number>> = {
  kick: 36,
  snare: 38,
  clap: 39,
  rim: 37,
  ch: 42,
  oh: 46,
  lt: 45,
  mt: 47,
  ht: 50,
  cow: 56,
  cym: 49,
  shk: 70,
};

interface MidiEvent {
  tick: number;
  priority: number;
  bytes: number[];
}

const ascii = (value: string) => Array.from(new TextEncoder().encode(value));
const u16 = (value: number) => [(value >>> 8) & 0xff, value & 0xff];
const u32 = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];

function variableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  while ((value >>= 7) > 0) buffer = (buffer << 8) | ((value & 0x7f) | 0x80);
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else return bytes;
  }
}

function chunk(id: string, data: number[]): number[] {
  return [...ascii(id), ...u32(data.length), ...data];
}

function track(events: MidiEvent[], endTick: number): number[] {
  const ordered = [...events, { tick: endTick, priority: 3, bytes: [0xff, 0x2f, 0x00] }]
    .sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  let previous = 0;
  const data: number[] = [];
  for (const event of ordered) {
    data.push(...variableLength(Math.max(0, event.tick - previous)), ...event.bytes);
    previous = event.tick;
  }
  return chunk("MTrk", data);
}

function textEvent(type: number, value: string): number[] {
  const bytes = ascii(value);
  return [0xff, type, ...variableLength(bytes.length), ...bytes];
}

function deterministicHit(blockIndex: number, step: number, probability: number): boolean {
  const value = Math.abs(Math.imul(blockIndex + 1, 1103515245) + Math.imul(step + 1, 12345)) % 100;
  return value < probability;
}

function sequenceLength(block: SequencerBlock, pulseTicks: number): number {
  return rhythmsFor(block).reduce((total, rhythm) => total + rhythm.steps * block.div * pulseTicks * rhythm.repeats, 0);
}

function voicesForHit(block: SequencerBlock, blockIndex: number, step: number): VoiceId[] {
  if (block.kind === "voice" && block.voice) return [block.voice];
  if (block.kind !== "bernoulli") return [];
  return [block.branchVoices[deterministicHit(blockIndex, step, block.prob) ? 0 : 1]];
}

function laneEvents(patch: Patch, block: SequencerBlock, blockIndex: number, endTick: number, channel: number, soloActive: boolean): MidiEvent[] {
  const pulseTicks = PPQ / patch.rate;
  const cycleLength = sequenceLength(block, pulseTicks);
  const events: MidiEvent[] = [{ tick: 0, priority: 0, bytes: textEvent(0x03, `Block ${blockIndex + 1}`) }];
  let absoluteStep = 0;
  for (let cycleStart = 0; cycleStart < endTick; cycleStart += cycleLength) {
    let rhythmStart = cycleStart;
    for (const rhythm of rhythmsFor(block)) {
      const stepTicks = pulseTicks * block.div;
      for (let repeat = 0; repeat < rhythm.repeats; repeat += 1) {
        for (let step = 0; step < rhythm.steps; step += 1) {
          const hitTick = rhythmStart + (repeat * rhythm.steps + step) * stepTicks;
          if (hitTick >= endTick || !euclidHit(step, rhythm.steps, rhythm.pulses, rhythm.rot)) {
            absoluteStep += 1;
            continue;
          }
          if (block.kind === "voice" && !deterministicHit(blockIndex, absoluteStep, block.prob)) {
            absoluteStep += 1;
            continue;
          }
          const swing = (absoluteStep * block.div) % 2 === 1 ? Math.round((patch.swing / 100) * pulseTicks * 0.5) : 0;
          for (const id of voicesForHit(block, blockIndex, absoluteStep)) {
            const voice = patch.voices[id];
            if (!isVoiceAudible(patch.voices, id, soloActive)) continue;
            const drumNote = DRUM_NOTES[id];
            const note = drumNote ?? Math.round(quantizeVoiceCv(voice.custom, 0, voice.tune).midi);
            const midiChannel = drumNote === undefined ? channel : 9;
            const velocity = Math.max(1, Math.min(127, Math.round(127 * patch.vol / 100 * voice.level / 100)));
            const start = Math.min(endTick - 1, hitTick + swing);
            const duration = Math.max(1, Math.min(endTick - start, Math.round(stepTicks * block.gate / 100)));
            events.push({ tick: start, priority: 1, bytes: [0x90 | midiChannel, note, velocity] });
            events.push({ tick: start + duration, priority: 0, bytes: [0x80 | midiChannel, note, 0] });
          }
          absoluteStep += 1;
        }
      }
      rhythmStart += rhythm.steps * stepTicks * rhythm.repeats;
    }
  }
  return events;
}

export function buildMidi(patch: Patch): Uint8Array {
  const soloActive = hasSoloedVoices(patch.voices);
  const pulseTicks = PPQ / patch.rate;
  const barTicks = PPQ * 4;
  const audible = patch.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => !block.mute && rhythmsFor(block).some((rhythm) => rhythm.pulses > 0) && (block.kind === "bernoulli" || (block.kind === "voice" && block.voice)));
  const longestSequence = audible.reduce((longest, { block }) => Math.max(longest, sequenceLength(block, pulseTicks)), 0);
  const endTick = Math.min(MAX_BARS * barTicks, Math.max(4 * barTicks, longestSequence));
  const microseconds = Math.round(60_000_000 / patch.bpm);
  const tempoEvents: MidiEvent[] = [
    { tick: 0, priority: 0, bytes: textEvent(0x03, "Beatling") },
    { tick: 0, priority: 0, bytes: [0xff, 0x51, 0x03, (microseconds >>> 16) & 0xff, (microseconds >>> 8) & 0xff, microseconds & 0xff] },
    { tick: 0, priority: 0, bytes: [0xff, 0x58, 0x04, 4, 2, 24, 8] },
  ];
  const tracks = [track(tempoEvents, endTick)];
  let synthChannel = 0;
  for (const { block, index } of audible) {
    tracks.push(track(laneEvents(patch, block, index, endTick, synthChannel, soloActive), endTick));
    if (block.kind === "voice" && (block.voice === "bassline" || block.voice === "lead")) synthChannel = synthChannel === 8 ? 10 : synthChannel + 1;
  }
  const header = chunk("MThd", [...u16(1), ...u16(tracks.length), ...u16(PPQ)]);
  return new Uint8Array([...header, ...tracks.flat()]);
}
