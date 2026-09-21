import { ROW_PARAMS, voiceTag } from "@/lib/constants";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, SequencerBlock } from "@/lib/types";
import { SequencerHeading } from "./sequencer-heading";
import { SequencerParameters } from "./sequencer-parameters";
import { SequencerRouting } from "./sequencer-routing";
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

export function SequencerCard({ showDial = true, index, block, blocks, visual, patchOpen, related, locks, onPatchOpen, onChange, onRandomize, onLockToggle, onParameterRandomize, onParameterLockToggle, changedFields = new Set() }: SequencerCardProps) {
  const effective = visual.effective;
  const blockLocked = ROW_PARAMS.every((parameter) => locks[parameter]);
  return (
    <article className={cn("sequencer-card", patchOpen && "is-selected", related && "is-related", visual.muted && "is-muted", visual.fire && "is-firing", changedFields.size > 0 && "has-variation-change")} data-testid={`block-${index + 1}`} data-block-index={index}>
      <SequencerHeading index={index} block={block} blockLocked={blockLocked} changedFields={changedFields} onChange={onChange} onRandomize={onRandomize} onLockToggle={onLockToggle} />
      <div className="card-body">
        {showDial && (block.voice ? <PatternDial steps={effective.steps} pulses={effective.pulses} rotation={effective.rot} position={visual.position} lfo={visual.lfo} fire={visual.fire} label={`${block.voice ? voiceTag(block.voice) : "LFO"}${block.div > 1 ? ` ÷${block.div}` : ""}`} /> : <ModulationScope compact block={block} visual={visual} />)}
        <SequencerParameters index={index} block={block} visual={visual} locks={locks} changedFields={changedFields} onChange={onChange} onParameterRandomize={onParameterRandomize} onParameterLockToggle={onParameterLockToggle} />
      </div>
      <SequencerRouting index={index} block={block} blocks={blocks} patchOpen={patchOpen} changedFields={changedFields} onPatchOpen={onPatchOpen} />
    </article>
  );
}
