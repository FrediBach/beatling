import { useId, useRef, useState, type CSSProperties } from "react";

interface EffectControlProps {
  label: string;
  accessibleLabel?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  defaultValue?: number;
  knob?: boolean;
  onChange: (value: number) => void;
}

/** Native keyboard control, vertical knob dragging, and a separately named value editor. */
export function EffectControl({ label, accessibleLabel = label, value, min = 0, max = 100, step = 1, suffix = "%", defaultValue = 0, knob = false, onChange }: EffectControlProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ y: number; value: number } | null>(null);
  const percent = (value - min) / (max - min) * 100;
  const normalize = (next: number) => Math.min(max, Math.max(min, Number((Math.round((next - min) / step) * step + min).toFixed(4))));
  const commit = (text: string) => {
    if (text.trim() && Number.isFinite(Number(text))) {
      const next = normalize(Number(text));
      if (next !== value) onChange(next);
    }
    setDraft(null);
  };

  return <div className={`effect-control${knob ? " effect-control-knob" : ""}`} style={{ "--control-fill": `${percent}%`, "--knob-angle": `${-135 + percent * 2.7}deg`, "--knob-fill": `${percent * 2.7}deg` } as CSSProperties}>
    <label htmlFor={id}>{label}</label>
    <div className={knob ? "effect-dial" : "effect-track"}>
      {knob && <div className="effect-dial-face" aria-hidden="true"><i /></div>}
      <input id={id} className="range" type="range" aria-label={accessibleLabel} aria-valuetext={`${value}${suffix}`} min={min} max={max} step={step} value={value}
        title={knob ? "Drag up or down · Shift for fine adjustment · Double-click to reset" : "Double-click to reset"}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => { if (value !== defaultValue) onChange(defaultValue); }}
        onPointerDown={knob ? (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { y: event.clientY, value };
        } : undefined}
        onPointerMove={knob ? (event) => {
          if (!drag.current) return;
          const next = Math.min(max, Math.max(min, drag.current.value + (drag.current.y - event.clientY) * (max - min) / (event.shiftKey ? 1600 : 160)));
          drag.current = { y: event.clientY, value: next };
          const normalized = normalize(next);
          if (normalized !== value) onChange(normalized);
        } : undefined}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      />
    </div>
    <div className="effect-value">
      <input type="text" inputMode="decimal" aria-label={`${accessibleLabel} value`} value={draft ?? String(value)}
        onFocus={(event) => { setDraft(String(value)); event.currentTarget.select(); }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation();
            event.currentTarget.value = String(value);
            event.currentTarget.blur();
          }
        }} />
      <span aria-hidden="true">{suffix}</span>
    </div>
  </div>;
}
