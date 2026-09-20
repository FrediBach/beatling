import { ArrowDown, ArrowUpRight, ChevronDown, ChevronsUpDown, Volume2, VolumeX } from "lucide-react";
import { PARAMS, ROW_PARAMS, VOICE_DEFS, padBlock, voiceTag } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import { connectionsFor } from "@/lib/routing";
import type { BlockParam, BlockVisualState, SequencerBlock } from "@/lib/types";
import { useDragNumber } from "@/hooks/use-drag-number";
import { PatternDial } from "@/components/pattern-dial";
import { cn } from "@/lib/utils";

interface SequencerCardProps {
  index: number;
  block: SequencerBlock;
  blocks: SequencerBlock[];
  visual: BlockVisualState;
  patchOpen: boolean;
  related: boolean;
  onPatchOpen: (index: number | null) => void;
  onChange: (block: SequencerBlock) => void;
}

export function SequencerCard({ index, block, blocks, visual, patchOpen, related, onPatchOpen, onChange }: SequencerCardProps) {
  const update = <K extends keyof SequencerBlock>(key: K, value: SequencerBlock[K]) => onChange({ ...block, [key]: value });
  const effective = visual.effective;
  const incoming = connectionsFor(blocks).filter((connection) => connection.target === index);
  const outgoing = connectionsFor(blocks).filter((connection) => connection.source === index);
  const sources = [...new Set(incoming.map((connection) => padBlock(connection.source)))];
  return (
    <article className={cn("sequencer-card", patchOpen && "is-selected", related && "is-related", visual.muted && "is-muted", visual.fire && "is-firing")} data-testid={`block-${index + 1}`}>
      <header className="card-heading">
        <span className="block-number">{padBlock(index)}</span>
        <div className="voice-select">
          <select aria-label={`Voice for block ${padBlock(index)}`} value={block.voice} onChange={(event) => update("voice", event.target.value as SequencerBlock["voice"])}>
            <option value="">Modulator</option>
            {VOICE_DEFS.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
          <ChevronDown size={11} />
        </div>
        <button type="button" className="mute-button" aria-label={`${block.mute ? "Unmute" : "Mute"} block ${padBlock(index)}`} aria-pressed={block.mute} onClick={() => update("mute", !block.mute)}>
          {block.mute ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </header>
      <div className="card-body">
        <PatternDial steps={effective.steps} pulses={effective.pulses} rotation={effective.rot} position={visual.position} lfo={visual.lfo} fire={visual.fire} label={`${block.voice ? voiceTag(block.voice) : "LFO"}${block.div > 1 ? ` ÷${block.div}` : ""}`} />
        <div className="parameters">
          {ROW_PARAMS.map((parameter) => <ParameterRow key={parameter} parameter={parameter} value={block[parameter]} modulated={block.modDst === parameter && block.modSrc !== "" && block.modAmt !== 0} onChange={(value) => {
            const definition = PARAMS[parameter];
            const next = clamp(Math.round(value), definition.min, definition.max);
            if (parameter === "steps") onChange({ ...block, steps: next, pulses: Math.min(block.pulses, next) });
            else if (parameter === "pulses") update("pulses", Math.min(next, block.steps));
            else update(parameter, next);
          }} />)}
        </div>
      </div>
      <button className="routing-strip" aria-label={`Patch block ${padBlock(index)}`} aria-expanded={patchOpen} onClick={() => onPatchOpen(patchOpen ? null : index)}>
        <span className={cn("jack", incoming.length > 0 && "connected")} />
        <span className="route-summary">{sources.length ? <><ArrowDown size={10} /> {sources.join(" · ")}</> : block.clk.includes("G") ? "Global clock" : "No clock"}</span>
        {outgoing.length > 0 && <span className="route-out"><ArrowUpRight size={10} />{outgoing.length}</span>}
        <span className="patch-action">Patch <ArrowUpRight size={11} /></span>
      </button>
    </article>
  );
}

function ParameterRow({ parameter, value, modulated, onChange }: { parameter: BlockParam; value: number; modulated: boolean; onChange: (value: number) => void }) {
  const drag = useDragNumber({ value, onChange });
  return <button type="button" className={cn("parameter-row", modulated && "is-modulated")} aria-label={`${PARAMS[parameter].label}: ${value}${PARAMS[parameter].suffix ?? ""}`} title="Drag up or down, or use arrow keys. Shift for larger changes." {...drag}>
    <span>{PARAMS[parameter].label}</span><ChevronsUpDown size={10} /><b>{value}{PARAMS[parameter].suffix}</b>
  </button>;
}
