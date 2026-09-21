import { useMemo } from "react";
import { euclidHit, lfoValue } from "@/lib/euclid";
import { euclideanCycle, euclideanLfoValue } from "@/lib/lfo";
import { LFO_SHAPES } from "@/lib/constants";
import type { BlockVisualState, LfoShape, SequencerBlock } from "@/lib/types";

function waveformPath(shape: LfoShape, steps: number, pulses: number, rot: number, euclidean: boolean) {
  const rhythm = { steps, pulses, rot };
  const samples = steps * (euclidean ? 16 : 1);
  let previous = 0;
  return Array.from({ length: samples + 1 }, (_, sample) => {
    // Include the cycle endpoint without wrapping the right edge to step zero.
    const position = Math.min(sample / samples * steps, steps - 0.00001);
    const cycle = euclideanCycle(position, rhythm);
    const start = cycle ? ((cycle.start % steps) + steps) % steps : 0;
    const randomExample = (start * 0.37 + 0.23) % 1;
    const value = euclidean ? euclideanLfoValue(shape, position, rhythm, randomExample) : lfoValue(shape, Math.floor(position) / steps, 0.5);
    const x = sample / samples * 160;
    const y = 6 + (1 - value) * 48;
    const jump = !euclidean || shape === "sqr" || shape === "rnd" || Math.abs(value - previous) > 0.5;
    previous = value;
    return sample === 0 ? `M${x},${y}` : jump ? `H${x} V${y}` : `L${x},${y}`;
  }).join(" ");
}

function scopeLabels(block: SequencerBlock, visual: BlockVisualState | undefined, compact: boolean) {
  const { steps, pulses, rot, div } = visual?.effective ?? block;
  const euclidean = !block.voice;
  const active = (visual?.position ?? -1) >= 0;
  const shape = LFO_SHAPES.find(([value]) => value === block.shape)?.[1];
  return {
    steps, pulses, rot, euclidean, active,
    value: visual?.lfo ?? 0.5,
    position: euclidean ? visual?.lfoPosition ?? visual?.position ?? 0 : (visual?.position ?? 0) + 0.5,
    heading: compact ? shape : `${euclidean ? "Euclidean LFO" : "LFO out"} · ${shape}`,
    output: active ? `${Math.round((visual?.lfo ?? 0.5) * 100)}%` : "Preview",
    caption: euclidean ? pulses === 0 ? "Fill 0 · no modulation" : `${pulses}/${steps} cycles · ÷${div}` : `${steps} steps · ÷${div}`,
    description: `${shape} modulation waveform${euclidean ? `, ${pulses} cycles in ${steps} steps, rotation ${rot}` : ""}${block.shape === "rnd" ? ", example random values" : ""}`,
  };
}

export function ModulationScope({ block, visual, compact = false }: { block: SequencerBlock; visual?: BlockVisualState; compact?: boolean }) {
  const labels = scopeLabels(block, visual, compact);
  const { steps, pulses, rot, euclidean } = labels;
  const path = useMemo(() => waveformPath(block.shape, steps, pulses, rot, euclidean), [block.shape, steps, pulses, rot, euclidean]);
  return <figure className={`modulation-scope${compact ? " is-compact" : ""}`}>
    <figcaption><span>{labels.heading}</span><span>{labels.output}</span></figcaption>
    <ScopeGraph labels={labels} path={path} />
    <span className="scope-caption">{labels.caption}</span>
    {!compact && euclidean && <p className="scope-explanation">{pulses === 0 ? "Raise Fill to create waveform cycles." : "Each filled step starts a wave that lasts until the next filled step."}{block.shape === "rnd" && " Random preview is illustrative; the dot shows the live value."}</p>}
  </figure>;
}

function ScopeGraph({ labels, path }: { labels: ReturnType<typeof scopeLabels>; path: string }) {
  const { steps, pulses, rot, euclidean, active, position, value, description } = labels;
  return <svg viewBox="0 0 160 72" role="img" aria-label={description}>
    <path className="scope-grid" d="M0 6H160 M0 30H160 M0 54H160 M40 0V60 M80 0V60 M120 0V60" />
    <path className="scope-wave" d={path} />
    {euclidean && Array.from({ length: steps }, (_, step) => <circle key={step} className={`scope-step${euclidHit(step, steps, pulses, rot) ? " is-hit" : ""}`} cx={(step + 0.5) / steps * 160} cy="67" r={steps > 16 ? 1.4 : 2} />)}
    {active && <g className="scope-cursor"><path d={`M${position / steps * 160} 0V60`} /><circle cx={position / steps * 160} cy={6 + (1 - value) * 48} r="3" /></g>}
  </svg>;
}
