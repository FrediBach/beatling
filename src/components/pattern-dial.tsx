import { euclidHit } from "@/lib/euclid";

interface PatternDialProps {
  steps: number;
  pulses: number;
  rotation: number;
  position: number;
  lfo: number;
  fire: boolean;
  label: string;
}

export function PatternDial({ steps, pulses, rotation, position, lfo, fire, label }: PatternDialProps) {
  const radius = 35;
  const dotRadius = steps > 24 ? 2 : steps > 16 ? 2.5 : steps > 10 ? 3.1 : 3.8;
  return (
    <svg className="size-[88px] shrink-0 overflow-visible" viewBox="0 0 100 100" aria-label={`${pulses} pulses over ${steps} steps`} role="img">
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
      {Array.from({ length: steps }, (_, index) => {
        const angle = (-90 + index * 360 / steps) * Math.PI / 180;
        const active = euclidHit(index, steps, pulses, rotation);
        const head = index === position;
        return (
          <circle
            key={index}
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
    </svg>
  );
}
