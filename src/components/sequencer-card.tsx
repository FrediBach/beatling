import { ArrowDown, ArrowUpRight, ChevronDown, ChevronsUpDown, Dices, Lock, LockOpen, Volume2, VolumeX } from "lucide-react";
import { PARAMS, ROW_PARAMS, VOICE_DEFS, padBlock, voiceTag } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import { connectionsFor } from "@/lib/routing";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, SequencerBlock } from "@/lib/types";
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
  locks: BlockRandomizationLocks;
  onPatchOpen: (index: number | null) => void;
  onChange: (block: SequencerBlock) => void;
  onRandomize: () => void;
  onLockToggle: () => void;
  onParameterRandomize: (parameter: BlockParam) => void;
  onParameterLockToggle: (parameter: BlockParam) => void;
}

export function SequencerCard({ index, block, blocks, visual, patchOpen, related, locks, onPatchOpen, onChange, onRandomize, onLockToggle, onParameterRandomize, onParameterLockToggle }: SequencerCardProps) {
  const update = <K extends keyof SequencerBlock>(key: K, value: SequencerBlock[K]) => onChange({ ...block, [key]: value });
  const effective = visual.effective;
  const incoming = connectionsFor(blocks).filter((connection) => connection.target === index);
  const outgoing = connectionsFor(blocks).filter((connection) => connection.source === index);
  const sources = [...new Set(incoming.map((connection) => padBlock(connection.source)))];
  const blockLocked = ROW_PARAMS.every((parameter) => locks[parameter]);
  return (
    <article className={cn("sequencer-card", patchOpen && "is-selected", related && "is-related", visual.muted && "is-muted", visual.fire && "is-firing")} data-testid={`block-${index + 1}`} data-block-index={index}>
      <span className="cable-ports cable-inputs" aria-hidden="true">{["Clock", "Reset", "Mute", "Mod"].map((input) => <i key={input} data-cable-port={`in-${input}`} />)}</span>
      <span className="cable-ports cable-outputs" aria-hidden="true">{["Trigger", "Gate", "LFO"].map((output) => <i key={output} data-cable-port={`out-${output}`} />)}</span>
      <header className="card-heading">
        <span className="block-number">{padBlock(index)}</span>
        <div className="voice-select">
          <select aria-label={`Voice for block ${padBlock(index)}`} value={block.voice} onChange={(event) => update("voice", event.target.value as SequencerBlock["voice"])}>
            <option value="">Modulator</option>
            {VOICE_DEFS.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
          {block.voice && <abbr className="voice-tag-badge" title={`Roland voice code for ${VOICE_DEFS.find((voice) => voice.id === block.voice)?.name}`}>{voiceTag(block.voice)}</abbr>}
          <ChevronDown size={11} />
        </div>
        <div className="card-tools">
          <button type="button" className="card-tool-button" aria-label={`Randomize block ${padBlock(index)}`} title="Randomize unlocked settings" disabled={blockLocked} onClick={onRandomize}><Dices size={12} /></button>
          <button type="button" className="card-tool-button lock-button" aria-label={`${blockLocked ? "Unlock" : "Lock"} all settings in block ${padBlock(index)}`} aria-pressed={blockLocked} title={blockLocked ? "Unlock all settings in this block" : "Lock all settings in this block"} onClick={onLockToggle}>{blockLocked ? <Lock size={11} /> : <LockOpen size={11} />}</button>
        </div>
        <button type="button" className="mute-button" aria-label={`${block.mute ? "Unmute" : "Mute"} block ${padBlock(index)}`} aria-pressed={block.mute} onClick={() => update("mute", !block.mute)}>
          {block.mute ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </header>
      <div className="card-body">
        <PatternDial steps={effective.steps} pulses={effective.pulses} rotation={effective.rot} position={visual.position} lfo={visual.lfo} fire={visual.fire} label={`${block.voice ? voiceTag(block.voice) : "LFO"}${block.div > 1 ? ` ÷${block.div}` : ""}`} />
        <div className="parameters">
          {ROW_PARAMS.map((parameter) => <ParameterRow key={parameter} index={index} parameter={parameter} value={block[parameter]} locked={locks[parameter]} modulated={block.modDst === parameter && block.modSrc !== "" && block.modAmt !== 0} onRandomize={() => onParameterRandomize(parameter)} onLockToggle={() => onParameterLockToggle(parameter)} onChange={(value) => {
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

function ParameterRow({ index, parameter, value, locked, modulated, onChange, onRandomize, onLockToggle }: { index: number; parameter: BlockParam; value: number; locked: boolean; modulated: boolean; onChange: (value: number) => void; onRandomize: () => void; onLockToggle: () => void }) {
  const drag = useDragNumber({ value, onChange });
  const label = PARAMS[parameter].label;
  return <div className={cn("parameter-row", modulated && "is-modulated", locked && "is-locked")}>
    <button type="button" className="parameter-value" aria-label={`${label}: ${value}${PARAMS[parameter].suffix ?? ""}`} title="Drag up or down, or use arrow keys. Shift for larger changes." {...drag}>
      <span>{label}</span><ChevronsUpDown size={10} /><b>{value}{PARAMS[parameter].suffix}</b>
    </button>
    <button type="button" className="parameter-action" aria-label={`Randomize ${label} in block ${padBlock(index)}`} title={`Randomize ${label.toLowerCase()}`} disabled={locked} onClick={onRandomize}><Dices size={10} /></button>
    <button type="button" className="parameter-action lock-button" aria-label={`${locked ? "Unlock" : "Lock"} ${label} in block ${padBlock(index)}`} aria-pressed={locked} title={`${locked ? "Unlock" : "Lock"} ${label.toLowerCase()}`} onClick={onLockToggle}>{locked ? <Lock size={9} /> : <LockOpen size={9} />}</button>
  </div>;
}
