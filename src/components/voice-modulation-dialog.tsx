import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { blockName, padBlock } from "@/lib/constants";
import { signedAmount, voiceTargetValue, VOICE_MODULATION_TARGETS } from "@/lib/modulation";
import type { EffectiveBlock, SequencerBlock, VoiceModulationRoute, VoiceState } from "@/lib/types";

interface VoiceModulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceName: string;
  value: VoiceState;
  blocks: SequencerBlock[];
  effective: Pick<EffectiveBlock, "tune" | "decay" | "level">;
  onChange: (voice: VoiceState) => void;
}

export function VoiceModulationDialog({ open, onOpenChange, voiceName, value, blocks, effective, onChange }: VoiceModulationDialogProps) {
  const focusDestination = useRef<VoiceModulationRoute["destination"] | null>(null);
  const used = new Set(value.modulations.map((route) => route.destination));
  const available = VOICE_MODULATION_TARGETS.filter(([destination]) => !used.has(destination));
  const update = (destination: VoiceModulationRoute["destination"], next: VoiceModulationRoute) => onChange({ ...value, modulations: value.modulations.map((route) => route.destination === destination ? next : route) });
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="voice-routing-dialog" aria-describedby="voice-routing-description">
      <header className="voice-routing-header">
        <div><span className="eyebrow">Voice patch bay</span><DialogTitle>{voiceName} modulation</DialogTitle><DialogDescription id="voice-routing-description">Route any block LFO directly to this shared voice. Every block that triggers {voiceName.toLowerCase()} uses the result.</DialogDescription></div>
      </header>
      <section className="modulation-editor" aria-label={`${voiceName} modulation targets`}>
        <div className="modulation-heading"><span className="eyebrow">Modulation in</span><span>{value.modulations.length} / {VOICE_MODULATION_TARGETS.length} targets</span></div>
        {value.modulations.map((route) => {
          const label = VOICE_MODULATION_TARGETS.find(([destination]) => destination === route.destination)?.[1] ?? route.destination;
          return <fieldset className="modulation-route" key={route.destination}>
            <legend>{label}</legend>
            <div className="modulation-route-top">
              <select className="control" aria-label={`Modulation source for ${voiceName} ${label}`} value={route.source} onChange={(event) => update(route.destination, { ...route, source: event.target.value as VoiceModulationRoute["source"] })}>
                <option value="">Choose source…</option>
                {blocks.map((source, sourceIndex) => <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {blockName(source)}</option>)}
              </select>
              <span aria-hidden="true">→</span>
              <select ref={(node) => { if (node && focusDestination.current === route.destination) { node.focus(); focusDestination.current = null; } }} className="control" aria-label={`Modulation destination for ${voiceName} ${label}`} value={route.destination} onChange={(event) => { const destination = event.target.value as VoiceModulationRoute["destination"]; focusDestination.current = destination; update(route.destination, { ...route, destination }); }}>
                {VOICE_MODULATION_TARGETS.map(([destination, name]) => <option key={destination} value={destination} disabled={used.has(destination) && destination !== route.destination}>{name}</option>)}
              </select>
              <button type="button" className="icon-button" aria-label={`Remove ${voiceName} ${label} modulation`} onClick={() => onChange({ ...value, modulations: value.modulations.filter((item) => item.destination !== route.destination) })}><X size={12} /></button>
            </div>
            <div className="modulation-depth"><span>Depth</span><input type="range" className="range" min={-100} max={100} value={Math.round(route.amount * 100)} aria-label={`Modulation amount for ${voiceName} ${label}`} onChange={(event) => update(route.destination, { ...route, amount: Number(event.target.value) / 100 })} /><output>{signedAmount(route.amount)}</output></div>
            <div className="modulation-result"><span>{label} <b>{voiceTargetValue(route.destination, value)}</b><span aria-hidden="true"> → </span><b>{voiceTargetValue(route.destination, value, effective)}</b></span><span>{route.source === "" ? "Select a source" : route.amount === 0 ? "Depth is zero" : "Live"}</span></div>
          </fieldset>;
        })}
        <button type="button" className="add-modulation" disabled={available.length === 0} onClick={() => onChange({ ...value, modulations: [...value.modulations, { source: value.modulations[0]?.source ?? "", destination: available[0][0], amount: 0.5 }] })}><Plus size={12} />Add modulation target</button>
        <p className="modulation-intro">At 100% depth, tune moves ±12 semitones, decay ±50 points, and level ±60% of its base. A future VCO can add its quantized V/Oct input here as another stable voice destination.</p>
      </section>
    </DialogContent>
  </Dialog>;
}
