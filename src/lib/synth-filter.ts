import { clamp } from "./euclid";

interface FilterSweep {
  start: number;
  duration: number;
  peak: number;
  resting: number;
  from: number;
  target: number;
  glideEnd: number;
  tracking: number;
  ceiling: number;
}

export interface FilterPoint {
  time: number;
  frequency: number;
}

const REFERENCE_FREQUENCY = 440 * 2 ** ((48 - 69) / 12); // C3

/** Combine exponential pitch and filter envelopes into bounded exponential segments. */
export function synthFilterSweep(sweep: FilterSweep): FilterPoint[] {
  const { start, duration, peak, resting, from, target, glideEnd, tracking, ceiling } = sweep;
  const decayEnd = start + duration;
  if (tracking === 0) {
    // Preserve the original two events and their exact values when disabled.
    return [{ time: start, frequency: clamp(peak, 1, ceiling) }, { time: decayEnd, frequency: clamp(resting, 1, ceiling) }];
  }
  const logFrequency = (time: number) => {
    const decayProgress = clamp((time - start) / duration, 0, 1);
    const glideProgress = glideEnd > start ? clamp((time - start) / (glideEnd - start), 0, 1) : 1;
    const pitch = Math.log(from) + Math.log(target / from) * glideProgress;
    return Math.log(peak) + Math.log(resting / peak) * decayProgress + tracking * (pitch - Math.log(REFERENCE_FREQUENCY));
  };
  const upper = Math.log(ceiling);
  const frequencyAt = (log: number) => clamp(Math.exp(log), 1, ceiling);
  const times = [...new Set([start, decayEnd, Math.max(start, glideEnd)])].sort((a, b) => a - b);
  const points: FilterPoint[] = [{ time: start, frequency: frequencyAt(logFrequency(start)) }];
  for (let i = 1; i < times.length; i++) {
    const before = logFrequency(times[i - 1]);
    const after = logFrequency(times[i]);
    // Insert boundary crossings so clipping holds a plateau rather than changing
    // the slope of the whole sweep. At most two crossings per segment.
    const crossings = [0, upper].filter((bound) => bound > Math.min(before, after) && bound < Math.max(before, after))
      .map((bound) => ({ time: times[i - 1] + (times[i] - times[i - 1]) * (bound - before) / (after - before), frequency: frequencyAt(bound) }))
      .sort((a, b) => a.time - b.time);
    points.push(...crossings, { time: times[i], frequency: frequencyAt(after) });
  }
  return points;
}
