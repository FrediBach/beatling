import { useId } from "react";
import { cn } from "@/lib/utils";

interface VoiceRangeProps {
  voiceName: string;
  label: string;
  min: number;
  max: number;
  value: number;
  effectiveValue?: number;
  signed?: boolean;
  changed?: boolean;
  onChange: (value: number) => void;
}

export function VoiceRange({ voiceName, label, min, max, value, effectiveValue, signed = false, changed = false, onChange }: VoiceRangeProps) {
  const inputId = useId();
  const format = (next: number) => `${signed && next > 0 ? "+" : ""}${Math.round(next)}`;
  const display = effectiveValue === undefined ? format(value) : `${format(value)}→${format(effectiveValue)}`;
  return (
    <div className={cn("voice-range grid grid-cols-[1fr_auto] items-center gap-x-1 text-[10px] text-muted", changed && "variation-changed")}>
      <label htmlFor={inputId}>{label}</label><output className="font-mono text-ink">{display}</output>
      <input id={inputId} aria-label={`${voiceName} ${label.toLowerCase()}`} className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
