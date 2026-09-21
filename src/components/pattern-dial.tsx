import { euclidHit } from "@/lib/euclid";
import type { RhythmPattern } from "@/lib/types";

interface PatternDialProps {
  steps: number;
  pulses: number;
  rotation: number;
  position: number;
  lfo: number;
  fire: boolean;
  label: string;
  patterns?: RhythmPattern[];
  activeRhythm?: number;
}

export function PatternDial({ steps, pulses, rotation, position, lfo, fire, label, patterns = [], activeRhythm = 0 }: PatternDialProps) {
  const radius = 35;
  const dotRadius = steps > 24 ? 2 : steps > 16 ? 2.5 : steps > 10 ? 3.1 : 3.8;
  return (
    <svg className="size-[88px] shrink-0 overflow-visible" viewBox="0 0 100 100" aria-label={`${pulses} pulses over ${steps} steps${patterns.length > 1 ? `, rhythm ${activeRhythm + 1} of ${patterns.length} in series` : ""}`} role="img">
      <circle className="fill-none stroke-rule-soft" cx="50" cy="50" r="45" />
      <circle
        className="origin-center -rotate-90 fill-none stroke-signal/45 stroke-[2.4]"
        cx="50"
        cy="50"
        r="45"
        pathLength="100"
        strokeDasharray="100 100"
        strokeDashoffset={100 - lfo * 100}
      />
      {patterns.map((pattern, patternIndex) => patternIndex === activeRhythm ? null : patternDots(pattern).filter((dot) => dot.hit).map((dot) => <circle key={dot.id} cx={(50 + Math.cos(dot.angle) * radius).toFixed(2)} cy={(50 + Math.sin(dot.angle) * radius).toFixed(2)} r={Math.max(1.7, dotRadius - 0.8)} className="fill-ink opacity-20" />))}
      {Array.from({ length: steps }, (_, step) => ({ id: `active-step-${step + 1}`, step })).map(({ id, step: index }) => {
        const angle = (-90 + index * 360 / steps) * Math.PI / 180;
        const active = euclidHit(index, steps, pulses, rotation);
        const head = index === position;
        return (
          <circle
            key={id}
            cx={(50 + Math.cos(angle) * radius).toFixed(2)}
            cy={(50 + Math.sin(angle) * radius).toFixed(2)}
            r={dotRadius}
            className={active
              ? head && fire ? "fill-signal stroke-signal" : head ? "fill-signal stroke-signal" : "fill-ink stroke-ink opacity-90"
              : head ? "fill-transparent stroke-signal stroke-[1.6]" : "fill-transparent stroke-ink opacity-35"}
          />
        );
      })}
      <text className="fill-ink font-mono text-[13px] tracking-[-.04em]" textAnchor="middle" x="50" y="51">{pulses}/{steps}</text>
      <text className="fill-muted font-mono text-[6.5px]" textAnchor="middle" x="50" y="61">{label}</text>
      {patterns.length > 1 && <text className="fill-muted font-mono text-[5.5px]" textAnchor="middle" x="50" y="69">{String.fromCharCode(65 + activeRhythm)} · {activeRhythm + 1}/{patterns.length}</text>}
    </svg>
  );
}

function patternDots(pattern: RhythmPattern) {
  return Array.from({ length: pattern.steps }, (_, step) => ({
    id: `${pattern.id}-step-${step + 1}`,
    hit: euclidHit(step, pattern.steps, pattern.pulses, pattern.rot),
    angle: (-90 + step * 360 / pattern.steps) * Math.PI / 180,
  }));
}
