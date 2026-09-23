import { ROW_PARAMS } from "@/lib/constants";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, SequencerBlock } from "@/lib/types";
import { SequencerHeading } from "./sequencer-heading";
import { SequencerParameters } from "./sequencer-parameters";
import { SequencerRouting } from "./sequencer-routing";
import { SequencerPattern } from "./sequencer-pattern";
import { cn } from "@/lib/utils";
import type { Connection } from "@/lib/routing";
import { useState } from "react";
import { RhythmSeriesDialog } from "@/components/rhythm-series-dialog";
import { padBlock } from "@/lib/constants";

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
  connections?: Connection[];
}

export function SequencerCard({ showDial = true, index, block, blocks, visual, patchOpen, related, locks, onPatchOpen, onChange, onRandomize, onLockToggle, onParameterRandomize, onParameterLockToggle, changedFields = new Set(), connections }: SequencerCardProps) {
  const [seriesOpen, setSeriesOpen] = useState(false);
  const blockLocked = ROW_PARAMS.every((parameter) => locks[parameter]);
  return (
    <article className={cn("sequencer-card", patchOpen && "is-selected", related && "is-related", visual.muted && "is-muted", visual.fire && "is-firing", changedFields.size > 0 && "has-variation-change")} data-testid={`block-${index + 1}`} data-routing-node data-block-index={index}>
      <SequencerHeading index={index} block={block} blockLocked={blockLocked} changedFields={changedFields} onChange={onChange} onRandomize={onRandomize} onLockToggle={onLockToggle} onSeriesOpen={() => setSeriesOpen(true)} />
      <div className="card-body">
        {showDial && <SequencerPattern block={block} visual={visual} />}
        <SequencerParameters index={index} block={block} visual={visual} locks={locks} changedFields={changedFields} onChange={onChange} onParameterRandomize={onParameterRandomize} onParameterLockToggle={onParameterLockToggle} />
      </div>
      <SequencerRouting index={index} block={block} blocks={blocks} patchOpen={patchOpen} changedFields={changedFields} onPatchOpen={onPatchOpen} connections={connections} />
      {seriesOpen && <RhythmSeriesDialog open onOpenChange={setSeriesOpen} block={block} blockNumber={padBlock(index)} activeRhythm={visual.rhythmIndex ?? 0} onChange={onChange} />}
    </article>
  );
}
