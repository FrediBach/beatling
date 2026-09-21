import { useId } from "react";
import { ChevronsUpDown, Dices, Lock, LockOpen } from "lucide-react";
import { PARAMS, ROW_PARAMS, padBlock } from "@/lib/constants";
import { clamp } from "@/lib/euclid";
import { signedAmount } from "@/lib/modulation";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, ModulationRoute, SequencerBlock } from "@/lib/types";
import { useDragNumber } from "@/hooks/use-drag-number";
import { cn } from "@/lib/utils";

interface SequencerParametersProps {
  index: number;
  block: SequencerBlock;
  visual: BlockVisualState;
  locks: BlockRandomizationLocks;
  changedFields: ReadonlySet<keyof SequencerBlock>;
  onChange: (block: SequencerBlock) => void;
  onParameterRandomize: (parameter: BlockParam) => void;
  onParameterLockToggle: (parameter: BlockParam) => void;
}

export function SequencerParameters({ index, block, visual, locks, changedFields, onChange, onParameterRandomize, onParameterLockToggle }: SequencerParametersProps) {
  const routes = new Map(block.modulations.map((route) => [route.destination, route]));
  return <div className="parameters">{ROW_PARAMS.map((parameter) => <ParameterRow key={parameter} index={index} parameter={parameter} customLabel={block.kind === "bernoulli" && parameter === "prob" ? "A chance" : undefined} value={block[parameter]} effectiveValue={visual.effective[parameter]} route={parameter === "steps" ? undefined : routes.get(parameter)} locked={locks[parameter]} changed={changedFields.has(parameter)} onRandomize={() => onParameterRandomize(parameter)} onLockToggle={() => onParameterLockToggle(parameter)} onChange={(value) => {
    const definition = PARAMS[parameter];
    const next = clamp(Math.round(value), definition.min, definition.max);
    if (parameter === "steps") onChange({ ...block, steps: next, pulses: Math.min(block.pulses, next) });
    else onChange({ ...block, [parameter]: parameter === "pulses" ? Math.min(next, block.steps) : next });
  }} />)}</div>;
}

function ParameterRow({ index, parameter, customLabel, value, locked, changed, route, effectiveValue, onChange, onRandomize, onLockToggle }: { index: number; parameter: BlockParam; customLabel?: string; value: number; locked: boolean; changed: boolean; route?: ModulationRoute; effectiveValue: number; onChange: (value: number) => void; onRandomize: () => void; onLockToggle: () => void }) {
  const drag = useDragNumber({ value, onChange });
  const label = customLabel ?? PARAMS[parameter].label;
  const modulated = route?.source !== "" && route !== undefined;
  const description = useId();
  return <div className={cn("parameter-row", modulated && "is-modulated", locked && "is-locked", changed && "variation-changed")}>
    <button type="button" aria-describedby={modulated ? description : undefined} className="parameter-value" aria-label={`${label}: ${value}${PARAMS[parameter].suffix ?? ""}`} title="Drag up or down, or use arrow keys. Shift for larger changes." {...drag}>
      <span>{label}</span><ChevronsUpDown size={10} /><b>{value}{PARAMS[parameter].suffix}</b>
      {modulated && <small className="modulation-value" aria-hidden="true" title={`Source ${padBlock(Number(route.source))}, depth ${signedAmount(route.amount)}; current ${Math.round(effectiveValue)}${PARAMS[parameter].suffix ?? ""}`}><span>{signedAmount(route.amount)}</span><strong>→{Math.round(effectiveValue)}{PARAMS[parameter].suffix}</strong></small>}
    </button>
    {modulated && <span id={description} className="sr-only">Modulation from block {padBlock(Number(route.source))}, depth {signedAmount(route.amount)}, current value {Math.round(effectiveValue)}{PARAMS[parameter].suffix}</span>}
    <button type="button" className="parameter-action" aria-label={`Randomize ${label} in block ${padBlock(index)}`} title={`Randomize ${label.toLowerCase()}`} disabled={locked} onClick={onRandomize}><Dices size={10} /></button>
    <button type="button" className="parameter-action lock-button" aria-label={`${locked ? "Unlock" : "Lock"} ${label} in block ${padBlock(index)}`} aria-pressed={locked} title={`${locked ? "Unlock" : "Lock"} ${label.toLowerCase()}`} onClick={onLockToggle}>{locked ? <Lock size={9} /> : <LockOpen size={9} />}</button>
  </div>;
}
