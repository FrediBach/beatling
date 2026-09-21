import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createRhythmId, MAX_RHYTHMS, rhythmsFor, withRhythms } from "@/lib/rhythm-series";
import type { RhythmPattern, SequencerBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RhythmSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: SequencerBlock;
  blockNumber: string;
  activeRhythm: number;
  onChange: (block: SequencerBlock) => void;
}

export function RhythmSeriesDialog({ open, onOpenChange, block, blockNumber, activeRhythm, onChange }: RhythmSeriesDialogProps) {
  const rhythms = rhythmsFor(block);
  const commit = (next: RhythmPattern[]) => onChange(withRhythms(block, next));
  const update = (index: number, key: keyof RhythmPattern, rawValue: number) => {
    const next = rhythms.map((rhythm) => ({ ...rhythm }));
    const value = Math.round(rawValue);
    if (key === "steps") {
      next[index].steps = Math.min(32, Math.max(1, value));
      next[index].pulses = Math.min(next[index].pulses, next[index].steps);
      next[index].rot = Math.min(next[index].rot, next[index].steps - 1);
    } else if (key === "pulses") next[index].pulses = Math.min(next[index].steps, Math.max(0, value));
    else if (key === "rot") next[index].rot = Math.min(next[index].steps - 1, Math.max(0, value));
    else next[index].repeats = Math.min(16, Math.max(1, value));
    commit(next);
  };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rhythms.length) return;
    const next = [...rhythms];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="rhythm-series-dialog">
      <header className="rhythm-series-header">
        <div><span className="eyebrow">Block {blockNumber}</span><DialogTitle>Rhythm series</DialogTitle><DialogDescription>Play several Euclidean rhythms in order. Routing, clock, probability, voice and modulation stay shared by the block.</DialogDescription></div>
        <Button type="button" variant="outline" size="sm" disabled={rhythms.length >= MAX_RHYTHMS} onClick={() => commit([...rhythms, { ...rhythms.at(-1)!, id: createRhythmId(), repeats: 1 }])}><Plus size={13} />Add rhythm</Button>
      </header>
      <div className="rhythm-series-list">
        {rhythms.map((rhythm, index) => <fieldset key={rhythm.id} className={cn("rhythm-series-row", index === activeRhythm && "is-active")}>
          <legend><span>{String.fromCharCode(65 + index)}</span>{index === activeRhythm ? "Playing" : `Rhythm ${index + 1}`}</legend>
          <SeriesNumber label="Steps" value={rhythm.steps} min={1} max={32} onChange={(value) => update(index, "steps", value)} />
          <SeriesNumber label="Fill" value={rhythm.pulses} min={0} max={rhythm.steps} onChange={(value) => update(index, "pulses", value)} />
          <SeriesNumber label="Rotate" value={rhythm.rot} min={0} max={rhythm.steps - 1} onChange={(value) => update(index, "rot", value)} />
          <SeriesNumber label="Plays" value={rhythm.repeats} min={1} max={16} onChange={(value) => update(index, "repeats", value)} />
          <div className="rhythm-series-actions">
            <button type="button" aria-label={`Move rhythm ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={12} /></button>
            <button type="button" aria-label={`Move rhythm ${index + 1} later`} disabled={index === rhythms.length - 1} onClick={() => move(index, 1)}><ArrowDown size={12} /></button>
            <button type="button" aria-label={`Duplicate rhythm ${index + 1}`} disabled={rhythms.length >= MAX_RHYTHMS} onClick={() => commit([...rhythms.slice(0, index + 1), { ...rhythm, id: createRhythmId(), repeats: 1 }, ...rhythms.slice(index + 1)])}><CopyPlus size={12} /></button>
            <button type="button" aria-label={`Delete rhythm ${index + 1}`} disabled={rhythms.length === 1} onClick={() => commit(rhythms.filter((_, rhythmIndex) => rhythmIndex !== index))}><Trash2 size={12} /></button>
          </div>
        </fieldset>)}
      </div>
      <p className="rhythm-series-note">“Plays” counts complete cycles of that rhythm. Reset returns this block to rhythm A.</p>
    </DialogContent>
  </Dialog>;
}

function SeriesNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="rhythm-series-number"><span>{label}</span><input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(event) => {
    const next = event.currentTarget.valueAsNumber;
    if (Number.isFinite(next)) onChange(next);
  }} /></label>;
}
