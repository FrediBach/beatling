import { blockTag } from "@/lib/constants";
import { rhythmsFor } from "@/lib/rhythm-series";
import type { BlockVisualState, SequencerBlock } from "@/lib/types";
import { ModulationScope } from "./modulation-scope";
import { PatternDial } from "./pattern-dial";

export function SequencerPattern({ block, visual }: { block: SequencerBlock; visual: BlockVisualState }) {
  if (block.kind === "modulator") return <ModulationScope compact block={block} visual={visual} />;
  const effective = visual.effective;
  return <PatternDial steps={effective.steps} pulses={effective.pulses} rotation={effective.rot} position={visual.position} lfo={visual.lfo} fire={visual.fire} label={`${blockTag(block)}${block.div > 1 ? ` ÷${block.div}` : ""}`} patterns={rhythmsFor(block)} activeRhythm={visual.rhythmIndex ?? 0} />;
}
