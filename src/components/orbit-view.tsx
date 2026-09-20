import type { CSSProperties, KeyboardEvent } from "react";
import { padBlock, voiceName } from "@/lib/constants";
import { euclidHit } from "@/lib/euclid";
import { divisionColor, divisionPhase, ringOffset } from "@/lib/orbit";
import type { BlockVisualState, SequencerBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OrbitViewProps {
  blocks: SequencerBlock[];
  visuals: BlockVisualState[];
  clockPulse: number;
  selected: number;
  onSelect: (index: number) => void;
}

const center = 300;
const radiusFor = (index: number) => 265 - index * 13;
function point(radius: number, phase: number) {
  const angle = phase * Math.PI * 2 - Math.PI / 2;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

export function OrbitView({ blocks, visuals, clockPulse, selected, onSelect }: OrbitViewProps) {
  const divisions = [...new Set(visuals.map((visual) => visual.effective.div))].sort((a, b) => a - b);
  const onKeyDown = (event: KeyboardEvent<SVGElement | HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (delta || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? blocks.length - 1 : (index + delta + blocks.length) % blocks.length;
      onSelect(next);
      document.getElementById(`orbit-select-${next}`)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onSelect(index);
    }
  };
  const current = visuals[selected].effective;
  return <div className="orbit-view">
    <div className="orbit-clock-legend" aria-label="Shared clock playheads">
      <span className="eyebrow">Shared clocks</span>
      {divisions.map((division) => <span key={division} style={{ "--division-color": divisionColor(division) } as CSSProperties}><i />÷{division}</span>)}
      <span className="orbit-cycle-note">16 clock steps / revolution</span>
    </div>
    <div className="orbit-stage">
      <svg className="orbit-wheel" viewBox="0 0 600 600" aria-label="All 16 rhythms in concentric rings">
        <circle cx={center} cy={center} r="286" className="orbit-rim" />
        {Array.from({ length: 16 }, (_, index) => {
          const a = point(276, index / 16);
          const b = point(index % 4 === 0 ? 285 : 281, index / 16);
          return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="orbit-tick" />;
        })}
        {blocks.map((block, index) => {
          const visual = visuals[index];
          const { steps, pulses, rot, div } = visual.effective;
          const radius = radiusFor(index);
          const phase = divisionPhase(clockPulse, div);
          const offset = clockPulse < 0 ? 0 : ringOffset(phase, visual.position, steps);
          const label = `Block ${padBlock(index)} ${voiceName(block.voice) || "Modulator"}, ${pulses} of ${steps}, divide ${div}`;
          return <g key={index} className={cn("orbit-ring", selected === index && "is-selected", visual.muted && "is-muted", pulses === 0 && "is-empty")} style={{ "--division-color": divisionColor(div) } as CSSProperties} role="button" tabIndex={-1} aria-label={`Select ring ${label}`} aria-pressed={selected === index} onClick={() => onSelect(index)} onKeyDown={(event) => onKeyDown(event, index)} data-testid={`orbit-ring-${index}`}>
            <title>{label}</title>
            <circle cx={center} cy={center} r={radius} className="orbit-ring-target" />
            <circle cx={center} cy={center} r={radius} className="orbit-ring-track" />
            {Array.from({ length: steps }, (_, step) => {
              const active = euclidHit(step, steps, pulses, rot);
              const hit = visual.fire && step === visual.position;
              const p = point(radius, step / steps + offset);
              return <circle key={step} cx={p.x} cy={p.y} r={hit ? 4.8 : active ? 3.4 : 2.3} className={cn("orbit-step", active && "is-hit", hit && "is-firing")} />;
            })}
          </g>;
        })}
        <g className="orbit-hands" aria-hidden="true">
          {divisions.map((division, index) => {
            const phase = divisionPhase(clockPulse, division);
            const start = point(54, phase);
            const end = point(271, phase);
            return <g key={division} data-testid={`orbit-playhead-${division}`} style={{ color: divisionColor(division) }}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="currentColor" strokeWidth="1.6" strokeDasharray={index === 0 ? undefined : `${6 + index * 2} 4`} opacity={clockPulse < 0 ? 0.25 : 0.85} />
              <circle cx={end.x} cy={end.y} r="4" fill="currentColor" />
            </g>;
          })}
        </g>
        <g className="orbit-center" aria-hidden="true">
          <text x={center} y="282" className="orbit-center-number" textAnchor="middle">{padBlock(selected)}</text>
          <text x={center} y="309" className="orbit-center-pattern" textAnchor="middle">{current.pulses}/{current.steps}</text>
          <text x={center} y="329" className="orbit-center-label" textAnchor="middle">SELECTED</text>
        </g>
      </svg>
    </div>
    <div className="orbit-selector" role="group" aria-label="Select a rhythm">
      {blocks.map((block, index) => <button type="button" id={`orbit-select-${index}`} key={index} aria-pressed={selected === index} aria-label={`Select block ${padBlock(index)} ${voiceName(block.voice) || "Modulator"}`} onClick={() => onSelect(index)} onKeyDown={(event) => onKeyDown(event, index)} className={cn(visuals[index].fire && "is-firing", visuals[index].muted && "is-muted")} style={{ "--division-color": divisionColor(visuals[index].effective.div) } as CSSProperties}>
        <span className="orbit-block-number">{padBlock(index)}</span><span className="orbit-block-name">{voiceName(block.voice) || "Modulator"}</span><span className="orbit-block-pattern">{visuals[index].effective.pulses}/{visuals[index].effective.steps}</span>
      </button>)}
    </div>
    <p className="orbit-help">Select a ring or a block to edit · Arrow keys move between rhythms</p>
  </div>;
}
