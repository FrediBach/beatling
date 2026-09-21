import type { RhythmPattern, SequencerBlock } from "@/lib/types";

export const MAX_RHYTHMS = 8;
export const MAX_RHYTHM_REPEATS = 16;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
let rhythmSerial = 0;

export function createRhythmId(): string {
  rhythmSerial += 1;
  return `rhythm-${Date.now().toString(36)}-${rhythmSerial.toString(36)}`;
}

export function normalizeRhythmPattern(value: unknown, fallback: RhythmPattern): RhythmPattern {
  if (!value || typeof value !== "object") return { ...fallback };
  const source = value as Partial<RhythmPattern>;
  const steps = clamp(Math.round(Number(source.steps) || fallback.steps), 1, 32);
  return {
    id: typeof source.id === "string" && source.id ? source.id : fallback.id,
    steps,
    pulses: clamp(Math.round(Number(source.pulses) || 0), 0, steps),
    rot: clamp(Math.round(Number(source.rot) || 0), 0, steps - 1),
    repeats: clamp(Math.round(Number(source.repeats) || 1), 1, MAX_RHYTHM_REPEATS),
  };
}

export function rhythmsFor(block: SequencerBlock): RhythmPattern[] {
  return [
    { id: block.rhythmId, steps: block.steps, pulses: block.pulses, rot: block.rot, repeats: block.repeats },
    ...block.series,
  ];
}

export function rhythmAt(block: SequencerBlock, index: number): RhythmPattern {
  const rhythms = rhythmsFor(block);
  return rhythms[clamp(Math.round(index) || 0, 0, rhythms.length - 1)];
}

export function withRhythms(block: SequencerBlock, values: RhythmPattern[]): SequencerBlock {
  const fallback = { id: block.rhythmId, steps: block.steps, pulses: block.pulses, rot: block.rot, repeats: block.repeats };
  const rhythms = (values.length ? values : [fallback])
    .slice(0, MAX_RHYTHMS)
    .map((value) => normalizeRhythmPattern(value, fallback));
  const [first, ...series] = rhythms;
  return { ...block, rhythmId: first.id, steps: first.steps, pulses: first.pulses, rot: first.rot, repeats: first.repeats, series };
}
