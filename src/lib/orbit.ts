/** One revolution represents 16 advances of a clock division. */
export function divisionPhase(clockPulse: number, division: number): number {
  const step = Math.floor((clockPulse + 1) / division) - 1;
  return step < 0 ? 0 : (step % 16) / 16;
}

/** Align the actual sounding step with its shared hand, preserving the Euclidean spacing. */
export function ringOffset(phase: number, position: number, steps: number): number {
  return position < 0 ? 0 : phase - position / steps;
}

export const DIVISION_COLORS = ["#c74728", "#328b93", "#ad8540", "#8864b4", "#608645", "#b15c81"];

export function divisionColor(division: number) {
  return DIVISION_COLORS[(division - 1) % DIVISION_COLORS.length];
}
