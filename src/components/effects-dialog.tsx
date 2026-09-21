import { ArrowRight, Power, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EffectProcessor } from "@/components/effect-processors";
import { EffectControl } from "@/components/effect-control";
import { EFFECT_IDS, createEffects } from "@/lib/effects";
import { VOICE_DEFS } from "@/lib/constants";
import type { EffectId, EffectsState } from "@/lib/types";

interface EffectsDialogProps {
  open: boolean;
  bpm?: number;
  onOpenChange: (open: boolean) => void;
  value: EffectsState;
  onChange: (value: EffectsState) => void;
}

const EFFECT_INFO = {
  distortion: { label: "Distortion", type: "Saturation", description: "Add weight, grit and harmonic edge." },
  reverb: { label: "Reverb", type: "Convolution", description: "Place your drums in a shared acoustic space." },
  delay: { label: "Delay", type: "Feedback echo", description: "Build rhythmic echoes with a filtered tail." },
  karplus: { label: "Karplus–Strong", type: "Waveguide resonator", description: "Add tuned string or hollow tube resonances to selected voices." },
  compressor: { label: "Compressor", type: "Parallel dynamics", description: "Blend in punch and sustain alongside the dry drums." },
};

const DEFAULTS = createEffects();

export function EffectsDialog({ open, onOpenChange, value, onChange, bpm = 120 }: EffectsDialogProps) {
  const [selected, setSelected] = useState<EffectId>("distortion");
  const enabledCount = EFFECT_IDS.filter((id) => value[id].enabled).length;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="effects-dialog" aria-describedby="effects-description">
      <header className="effects-header">
        <div><span className="eyebrow">Sound shaping / FX–05</span><DialogTitle>Effects mixer</DialogTitle>
          <DialogDescription id="effects-description">Five shared effects. An individual send for every voice.</DialogDescription></div>
        <Button type="button" variant="outline" onClick={() => onChange(createEffects())}><RotateCcw size={13} />Reset effects</Button>
      </header>
      <Tabs className="effects-rack" value={selected} onValueChange={(id) => {
        // Tabs activate on pointer down; commit an open value editor before it unmounts.
        if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
        setSelected(id as EffectId);
      }}>
        <TabsList className="effects-tabs" aria-label="Effect processors">
          {EFFECT_IDS.map((id, index) => <TabsTrigger className="effect-tab" key={id} value={id}>
            <span className="effect-tab-number">0{index + 1}</span>
            <span className="effect-tab-name">{EFFECT_INFO[id].label}<small>{EFFECT_INFO[id].type}</small></span>
            <span className="effect-tab-state" data-enabled={value[id].enabled || undefined}><i />{value[id].enabled ? "On" : "Bypassed"}</span>
          </TabsTrigger>)}
        </TabsList>
        {EFFECT_IDS.map((id) => <TabsContent key={id} value={id} className="effects-panel">
          <EffectEditor bpm={bpm} id={id} value={value} onChange={onChange} />
          <VoiceSends id={id} value={value} onChange={onChange} />
        </TabsContent>)}
      </Tabs>
      <footer className="effects-footer"><span className="effects-signal-path">Voice <ArrowRight size={12} /> Send <ArrowRight size={12} /> Effect <ArrowRight size={12} /> Return</span><span>Dry signal preserved · {enabledCount}/{EFFECT_IDS.length} effects on</span></footer>
    </DialogContent>
  </Dialog>;
}

type EditorProps<Id extends EffectId> = { id: Id; value: EffectsState; onChange: (value: EffectsState) => void };
function EffectEditor<Id extends EffectId>({ id, value, onChange, bpm }: EditorProps<Id> & { bpm: number }) {
  const effect = value[id];
  const info = EFFECT_INFO[id];
  const update = (changes: Partial<EffectsState[Id]>) => onChange({ ...value, [id]: { ...effect, ...changes } });
  return <section className="effect-editor" aria-label={`${info.label} settings`} data-enabled={effect.enabled || undefined}>
    <header className="effect-editor-heading"><div><span className="eyebrow">Processor</span><h3>{info.label}</h3></div>
      <button type="button" className="effect-enable" aria-label={`${effect.enabled ? "Disable" : "Enable"} ${info.label.toLowerCase()}`} aria-pressed={effect.enabled} onClick={() => update({ enabled: !effect.enabled } as Partial<EffectsState[Id]>)}><Power size={14} />{effect.enabled ? "On" : "Bypassed"}</button></header>
    <p className="effect-description">{info.description}</p>
    <EffectProcessor id={id} value={value} bpm={bpm} onChange={onChange} />
    <div className="effect-return"><EffectControl label="Return level" accessibleLabel={`${info.label} Return`} value={effect.return} defaultValue={DEFAULTS[id].return} onChange={(next) => update({ return: next } as Partial<EffectsState[Id]>)} /><p>Amount of processed sound in the mix.</p></div>
    <div className="effect-editor-bottom"><span>Drag dial ↕ · Shift for fine control</span><button type="button" onClick={() => onChange({ ...value, [id]: { ...DEFAULTS[id], enabled: effect.enabled } })} aria-label={`Reset ${info.label.toLowerCase()} parameters`}><RotateCcw size={11} />Reset</button></div>
  </section>;
}

function VoiceSends({ id, value, onChange }: EditorProps<EffectId>) {
  const info = EFFECT_INFO[id];
  const sendCount = VOICE_DEFS.filter((voice) => value.sends[voice.id][id] > 0).length;
  return <section className="effects-sends" aria-label={`${info.label} voice sends`}>
    <header className="effects-sends-heading"><div><span className="eyebrow">Routing / {VOICE_DEFS.length} voices</span><h3>Send to {info.label.toLowerCase()}</h3></div><span>{sendCount} routed</span></header>
    <p className="effects-send-status" role="status">{!value[id].enabled ? "Effect bypassed. Enable it to hear these sends." : value[id].return === 0 ? "Return is at zero. Raise it to hear this effect." : sendCount === 0 ? "Raise a voice send to hear this effect." : "Sends follow voice level, before the master."}</p>
    <div className="effect-send-list">
      {VOICE_DEFS.map((voice) => <div className="effect-send-row" key={voice.id} data-active={value.sends[voice.id][id] > 0 || undefined}>
        <span className="send-voice-tag" aria-hidden="true">{voice.tag}</span>
        <EffectControl label={voice.name} accessibleLabel={`${voice.name} ${info.label} send`} value={value.sends[voice.id][id]} onChange={(next) => onChange({ ...value, sends: { ...value.sends, [voice.id]: { ...value.sends[voice.id], [id]: next } } })} />
      </div>)}
    </div>
    <div className="effects-sends-bottom"><span>Click a value to type · Double-click a control to reset</span><button type="button" disabled={sendCount === 0} onClick={() => onChange({ ...value, sends: Object.fromEntries(VOICE_DEFS.map((voice) => [voice.id, { ...value.sends[voice.id], [id]: 0 }])) as EffectsState["sends"] })} aria-label={`Clear ${info.label.toLowerCase()} sends`}>Clear sends</button></div>
  </section>;
}
