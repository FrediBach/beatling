import { useEffect, useRef } from "react";
import { Cable, Volume2, VolumeX } from "lucide-react";
import { LFO_SHAPES, MOD_DESTS, PARAMS, ROW_PARAMS, VOICE_DEFS, padBlock, voiceName, voiceTag } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import type { BlockParam, BlockVisualState, ClockSource, SequencerBlock } from "@/lib/types";
import { useDragNumber } from "@/hooks/use-drag-number";
import { PatternDial } from "@/components/pattern-dial";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SequencerCardProps {
  index: number;
  block: SequencerBlock;
  blocks: SequencerBlock[];
  visual: BlockVisualState;
  patchOpen: boolean;
  onPatchOpen: (index: number | null) => void;
  onChange: (block: SequencerBlock) => void;
}

export function SequencerCard({ index, block, blocks, visual, patchOpen, onPatchOpen, onChange }: SequencerCardProps) {
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!patchOpen) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) onPatchOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [patchOpen, onPatchOpen]);

  const update = <K extends keyof SequencerBlock>(key: K, value: SequencerBlock[K]) => onChange({ ...block, [key]: value });
  const effective = visual.effective;

  return (
    <article
      ref={cardRef}
      className={cn(
        "relative min-w-0 rounded-sm border bg-sheet p-2 transition-[border-color,opacity]",
        visual.fire ? "border-signal" : "border-rule",
        visual.muted && "opacity-50",
      )}
      data-testid={`block-${index + 1}`}
    >
      <header className="mb-1.5 flex items-center gap-1">
        <span className="w-5 font-mono text-[10px] tabular-nums text-muted">{padBlock(index)}</span>
        <select
          className="min-w-0 flex-1 appearance-none border-b border-transparent bg-transparent px-0.5 py-0.5 text-xs font-medium hover:border-rule focus:border-signal focus:outline-none"
          aria-label={`Voice for block ${padBlock(index)}`}
          value={block.voice}
          onChange={(event) => update("voice", event.target.value as SequencerBlock["voice"])}
        >
          <option value="">no voice</option>
          {VOICE_DEFS.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
        </select>
        <Button
          type="button"
          variant={block.mute ? "destructive" : "outline"}
          size="sm"
          className="size-6 px-0"
          aria-label={`${block.mute ? "Unmute" : "Mute"} block ${padBlock(index)}`}
          aria-pressed={block.mute}
          onClick={() => update("mute", !block.mute)}
        >
          {block.mute ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
        </Button>
        <Button
          type="button"
          variant={patchOpen ? "default" : "outline"}
          size="sm"
          className="h-6 px-1.5 font-mono text-[9px]"
          aria-label={`Patch block ${padBlock(index)}`}
          aria-expanded={patchOpen}
          onClick={() => onPatchOpen(patchOpen ? null : index)}
        >
          <Cable className="size-3" /> patch
        </Button>
      </header>

      <div className="flex items-center gap-2">
        <PatternDial
          steps={effective.steps}
          pulses={effective.pulses}
          rotation={effective.rot}
          position={visual.position}
          lfo={visual.lfo}
          fire={visual.fire}
          label={`${block.voice ? voiceTag(block.voice) : "lfo"}${block.div > 1 ? ` ÷${block.div}` : ""}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          {ROW_PARAMS.map((parameter) => (
            <ParameterRow
              key={parameter}
              parameter={parameter}
              value={block[parameter]}
              modulated={block.modDst === parameter && block.modSrc !== "" && block.modAmt !== 0}
              onChange={(value) => {
                const definition = PARAMS[parameter];
                const nextValue = clamp(Math.round(value), definition.min, definition.max);
                if (parameter === "steps") onChange({ ...block, steps: nextValue, pulses: Math.min(block.pulses, nextValue) });
                else if (parameter === "pulses") update("pulses", Math.min(nextValue, block.steps));
                else update(parameter, nextValue);
              }}
            />
          ))}
        </div>
      </div>

      {patchOpen && (
        <div className="absolute inset-x-[-1px] top-[calc(100%+3px)] z-40 flex flex-col gap-2 rounded-sm border border-ink bg-sheet p-2.5 shadow-2xl">
          <div>
            <p className="mb-1 text-[10px] text-muted">Clock in — sources add up</p>
            <div className="flex flex-wrap gap-0.5">
              <ClockChip label="G" title="Global clock" active={block.clk.includes("G")} onClick={() => toggleClock("G", block, onChange)} />
              {blocks.map((_other, sourceIndex) => sourceIndex !== index && (
                <ClockChip
                  key={sourceIndex}
                  label={padBlock(sourceIndex)}
                  title={`Trigger out of block ${padBlock(sourceIndex)}`}
                  active={block.clk.includes(String(sourceIndex) as ClockSource)}
                  onClick={() => toggleClock(String(sourceIndex) as ClockSource, block, onChange)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
            <PatchLabel>Reset in</PatchLabel>
            <select className="control" value={block.rst} onChange={(event) => update("rst", event.target.value as SequencerBlock["rst"])}>
              <option value="">none</option>
              <option value="BAR">every bar</option>
              {blocks.map((source, sourceIndex) => sourceIndex !== index && (
                <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {source.voice ? voiceName(source.voice) : "block"}</option>
              ))}
            </select>

            <PatchLabel>Mute in</PatchLabel>
            <BlockSelect value={block.mut} index={index} blocks={blocks} onChange={(value) => update("mut", value)} />

            <PatchLabel>Gate</PatchLabel>
            <RangeWithOutput min={5} max={200} step={5} value={block.gate} suffix="%" onChange={(value) => update("gate", value)} />

            <PatchLabel>LFO out</PatchLabel>
            <select className="control" value={block.shape} onChange={(event) => update("shape", event.target.value as SequencerBlock["shape"])}>
              {LFO_SHAPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

            <PatchLabel>Mod from</PatchLabel>
            <BlockSelect value={block.modSrc} index={index} blocks={blocks} onChange={(value) => update("modSrc", value)} />

            <PatchLabel>Mod to</PatchLabel>
            <select className="control" value={block.modDst} onChange={(event) => update("modDst", event.target.value as SequencerBlock["modDst"])}>
              {MOD_DESTS.map(([value, label]) => <option key={value || "none"} value={value}>{label}</option>)}
            </select>

            <PatchLabel>Amount</PatchLabel>
            <RangeWithOutput min={-100} max={100} value={Math.round(block.modAmt * 100)} suffix="%" onChange={(value) => update("modAmt", value / 100)} />
          </div>
          <p className="text-[10px] leading-snug text-muted">This block sends a trigger, a gate and an LFO to every other block.</p>
        </div>
      )}
    </article>
  );
}

function ParameterRow({ parameter, value, modulated, onChange }: { parameter: BlockParam; value: number; modulated: boolean; onChange: (value: number) => void }) {
  const drag = useDragNumber({ value, onChange });
  return (
    <button
      type="button"
      className="flex w-full touch-none cursor-ns-resize items-baseline justify-between gap-1 rounded-sm border-b border-rule-soft px-1 py-0.5 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      aria-label={`${PARAMS[parameter].label}: ${value}${PARAMS[parameter].suffix ?? ""}`}
      {...drag}
    >
      <span className="whitespace-nowrap text-[11px] text-muted">{PARAMS[parameter].label}</span>
      <b className={cn("font-mono text-xs font-medium tabular-nums", modulated && "text-signal")}>{value}{PARAMS[parameter].suffix}</b>
    </button>
  );
}

function ClockChip({ label, title, active, onClick }: { label: string; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      className={cn("flex h-[18px] w-5 items-center justify-center rounded-sm border font-mono text-[9px]", active ? "border-signal bg-signal text-white" : "border-rule text-muted hover:border-ink")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function toggleClock(source: ClockSource, block: SequencerBlock, onChange: (block: SequencerBlock) => void) {
  const clk = block.clk.includes(source) ? block.clk.filter((item) => item !== source) : [...block.clk, source];
  onChange({ ...block, clk });
}

function PatchLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-muted">{children}</span>;
}

function BlockSelect({ value, index, blocks, onChange }: { value: SequencerBlock["mut"]; index: number; blocks: SequencerBlock[]; onChange: (value: SequencerBlock["mut"]) => void }) {
  return (
    <select className="control" value={value} onChange={(event) => onChange(event.target.value as SequencerBlock["mut"])}>
      <option value="">none</option>
      {blocks.map((source, sourceIndex) => sourceIndex !== index && (
        <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {source.voice ? voiceName(source.voice) : "block"}</option>
      ))}
    </select>
  );
}

function RangeWithOutput({ min, max, step = 1, value, suffix, onChange }: { min: number; max: number; step?: number; value: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input className="range min-w-0 flex-1" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output className="w-9 text-right font-mono text-[10px] text-muted">{value}{suffix}</output>
    </div>
  );
}
