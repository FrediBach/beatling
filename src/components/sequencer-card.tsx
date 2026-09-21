import { ArrowDown, ArrowUpRight } from "lucide-react";
import { ROW_PARAMS, padBlock, voiceTag } from "@/lib/constants";
import { connectionsFor } from "@/lib/routing";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, SequencerBlock } from "@/lib/types";
import { SequencerHeading } from "./sequencer-heading";
import { SequencerParameters } from "./sequencer-parameters";
import { ModulationScope } from "./modulation-scope";
import { PatternDial } from "@/components/pattern-dial";
import { cn } from "@/lib/utils";

interface SequencerCardProps {
  showDial?: boolean;
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
  changedFields?: ReadonlySet<keyof SequencerBlock>;
}

const ROUTING_FIELDS: Array<keyof SequencerBlock> = ["clk", "rst", "mut", "gate", "modulations", "shape"];

export function SequencerCard({ showDial = true, index, block, blocks, visual, patchOpen, related, locks, onPatchOpen, onChange, onRandomize, onLockToggle, onParameterRandomize, onParameterLockToggle, changedFields = new Set() }: SequencerCardProps) {
  const effective = visual.effective;
  const blockLocked = ROW_PARAMS.every((parameter) => locks[parameter]);
  return (
    <article className={cn("sequencer-card", patchOpen && "is-selected", related && "is-related", visual.muted && "is-muted", visual.fire && "is-firing", changedFields.size > 0 && "has-variation-change")} data-testid={`block-${index + 1}`} data-block-index={index}>
      <span className="cable-ports cable-inputs" aria-hidden="true">{["Clock", "Reset", "Mute", "Mod"].map((input) => <i key={input} data-cable-port={`in-${input}`} />)}</span>
      <span className="cable-ports cable-outputs" aria-hidden="true">{["Trigger", "Gate", "LFO"].map((output) => <i key={output} data-cable-port={`out-${output}`} />)}</span>
      <SequencerHeading index={index} block={block} blockLocked={blockLocked} changedFields={changedFields} onChange={onChange} onRandomize={onRandomize} onLockToggle={onLockToggle} />
      <div className="card-body">
        {showDial && (block.voice ? <PatternDial steps={effective.steps} pulses={effective.pulses} rotation={effective.rot} position={visual.position} lfo={visual.lfo} fire={visual.fire} label={`${block.voice ? voiceTag(block.voice) : "LFO"}${block.div > 1 ? ` ÷${block.div}` : ""}`} /> : <ModulationScope compact block={block} visual={visual} />)}
        <SequencerParameters index={index} block={block} visual={visual} locks={locks} changedFields={changedFields} onChange={onChange} onParameterRandomize={onParameterRandomize} onParameterLockToggle={onParameterLockToggle} />
      </div>
      <RoutingStrip index={index} block={block} blocks={blocks} patchOpen={patchOpen} changedFields={changedFields} onPatchOpen={onPatchOpen} />
    </article>
  );
}


function RoutingStrip({ index, block, blocks, patchOpen, changedFields, onPatchOpen }: Pick<SequencerCardProps, "index" | "block" | "blocks" | "patchOpen" | "onPatchOpen"> & { changedFields: ReadonlySet<keyof SequencerBlock> }) {
  const connections = connectionsFor(blocks);
  const incoming = connections.filter((connection) => connection.target === index);
  const outgoing = connections.filter((connection) => connection.source === index);
  const sources = [...new Set(incoming.map((connection) => padBlock(connection.source)))];
  return (
      <button className={cn("routing-strip", ROUTING_FIELDS.some((field) => changedFields.has(field)) && "variation-changed")} aria-label={`Patch block ${padBlock(index)}`} aria-expanded={patchOpen} onClick={() => onPatchOpen(patchOpen ? null : index)}>
        <span className={cn("jack", incoming.length > 0 && "connected")} />
        <span className="route-summary">{sources.length ? <><ArrowDown size={10} /> {sources.join(" · ")}</> : block.clk.includes("G") ? "Global clock" : "No clock"}</span>
        {outgoing.length > 0 && <span className="route-out"><ArrowUpRight size={10} />{outgoing.length}</span>}
        <span className="patch-action">Patch <ArrowUpRight size={11} /></span>
      </button>
  );
}
