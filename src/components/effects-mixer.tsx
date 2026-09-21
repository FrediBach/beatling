import { lazy, Suspense, useState } from "react";
import { AudioLines } from "lucide-react";
import { EFFECT_IDS, effectsHaveChanges } from "@/lib/effects";
import type { EffectsState } from "@/lib/types";
import { cn } from "@/lib/utils";

const EffectsDialog = lazy(() => import("@/components/effects-dialog").then((module) => ({ default: module.EffectsDialog })));

export function EffectsMixer({ value, baseValue, bpm, onChange }: { value: EffectsState; baseValue?: EffectsState; bpm: number; onChange: (value: EffectsState) => void }) {
  const [open, setOpen] = useState(false);
  const enabledCount = EFFECT_IDS.filter((effect) => value[effect].enabled).length;
  const changed = baseValue !== undefined && effectsHaveChanges(value, baseValue);
  return <>
    <button type="button" className={cn("effects-button", enabledCount > 0 && "has-active-effects", changed && "variation-changed")} aria-haspopup="dialog" aria-label={`Open effects mixer, ${enabledCount} ${enabledCount === 1 ? "effect" : "effects"} enabled`} onClick={() => setOpen(true)}><AudioLines size={15} /><span>Effects</span><small>{enabledCount || "off"}</small></button>
    {open && <Suspense fallback={<span role="status">Loading effects…</span>}><EffectsDialog bpm={bpm} open onOpenChange={setOpen} value={value} onChange={onChange} /></Suspense>}
  </>;
}
