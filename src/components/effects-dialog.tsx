import { RotateCcw } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EFFECT_IDS, createEffects } from "@/lib/effects";
import { VOICE_DEFS } from "@/lib/constants";
import type { EffectId, EffectsState, VoiceId } from "@/lib/types";

interface EffectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: EffectsState;
  onChange: (value: EffectsState) => void;
}

const EFFECT_LABELS: Record<EffectId, string> = {
  distortion: "Distortion",
  reverb: "Reverb",
  delay: "Delay",
  compressor: "Compressor",
};

export function EffectsDialog({ open, onOpenChange, value, onChange }: EffectsDialogProps) {
  const updateEffect = <Id extends EffectId>(id: Id, next: EffectsState[Id]) => onChange({ ...value, [id]: next });
  const updateSend = (voice: VoiceId, effect: EffectId, next: number) => onChange({
    ...value,
    sends: { ...value.sends, [voice]: { ...value.sends[voice], [effect]: next } },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="effects-dialog" aria-describedby="effects-description">
        <header className="effects-header">
          <div>
            <span className="eyebrow">Shared effects / voice sends</span>
            <DialogTitle>Effects mixer</DialogTitle>
            <DialogDescription id="effects-description">
              Shape four shared returns, then send each drum voice into them independently. The dry signal always remains available.
            </DialogDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => onChange(createEffects())}>
            <RotateCcw size={13} />Reset effects
          </Button>
        </header>

        <div className="effects-scroll">
          <section className="effects-config" aria-labelledby="effects-config-title">
            <div className="effects-section-heading"><h3 id="effects-config-title">Return configuration</h3><span>Shared processing</span></div>
            <div className="effects-config-grid">
              <EffectCard id="distortion" enabled={value.distortion.enabled} onEnabledChange={(enabled) => updateEffect("distortion", { ...value.distortion, enabled })}>
                <EffectParameter label="Drive" min={0} max={100} value={value.distortion.drive} suffix="%" onChange={(drive) => updateEffect("distortion", { ...value.distortion, drive })} />
                <EffectParameter label="Tone" min={400} max={16000} step={100} value={value.distortion.tone} suffix="Hz" onChange={(tone) => updateEffect("distortion", { ...value.distortion, tone })} />
                <EffectParameter label="Return" min={0} max={100} value={value.distortion.return} suffix="%" onChange={(next) => updateEffect("distortion", { ...value.distortion, return: next })} />
              </EffectCard>
              <EffectCard id="reverb" enabled={value.reverb.enabled} onEnabledChange={(enabled) => updateEffect("reverb", { ...value.reverb, enabled })}>
                <EffectParameter label="Damping" min={1000} max={16000} step={100} value={value.reverb.damping} suffix="Hz" onChange={(damping) => updateEffect("reverb", { ...value.reverb, damping })} />
                <EffectParameter label="Return" min={0} max={100} value={value.reverb.return} suffix="%" onChange={(next) => updateEffect("reverb", { ...value.reverb, return: next })} />
              </EffectCard>
              <EffectCard id="delay" enabled={value.delay.enabled} onEnabledChange={(enabled) => updateEffect("delay", { ...value.delay, enabled })}>
                <EffectParameter label="Time" min={40} max={750} step={5} value={value.delay.time} suffix="ms" onChange={(time) => updateEffect("delay", { ...value.delay, time })} />
                <EffectParameter label="Feedback" min={0} max={85} value={value.delay.feedback} suffix="%" onChange={(feedback) => updateEffect("delay", { ...value.delay, feedback })} />
                <EffectParameter label="Tone" min={500} max={12000} step={100} value={value.delay.tone} suffix="Hz" onChange={(tone) => updateEffect("delay", { ...value.delay, tone })} />
                <EffectParameter label="Return" min={0} max={100} value={value.delay.return} suffix="%" onChange={(next) => updateEffect("delay", { ...value.delay, return: next })} />
              </EffectCard>
              <EffectCard id="compressor" enabled={value.compressor.enabled} onEnabledChange={(enabled) => updateEffect("compressor", { ...value.compressor, enabled })}>
                <EffectParameter label="Threshold" min={-60} max={0} value={value.compressor.threshold} suffix="dB" onChange={(threshold) => updateEffect("compressor", { ...value.compressor, threshold })} />
                <EffectParameter label="Ratio" min={1} max={20} step={0.5} value={value.compressor.ratio} suffix=":1" onChange={(ratio) => updateEffect("compressor", { ...value.compressor, ratio })} />
                <EffectParameter label="Attack" min={0} max={100} value={value.compressor.attack} suffix="ms" onChange={(attack) => updateEffect("compressor", { ...value.compressor, attack })} />
                <EffectParameter label="Release" min={50} max={1000} step={10} value={value.compressor.release} suffix="ms" onChange={(release) => updateEffect("compressor", { ...value.compressor, release })} />
                <EffectParameter label="Return" min={0} max={100} value={value.compressor.return} suffix="%" onChange={(next) => updateEffect("compressor", { ...value.compressor, return: next })} />
              </EffectCard>
            </div>
          </section>

          <section className="effects-sends" aria-labelledby="effects-sends-title">
            <div className="effects-section-heading"><h3 id="effects-sends-title">Voice sends</h3><span>Pre-master / post-voice level</span></div>
            <div className="send-matrix" role="group" aria-label="Voice effect sends">
              <div className="send-row send-head" aria-hidden="true"><span>Voice</span>{EFFECT_IDS.map((effect) => <span key={effect}>{EFFECT_LABELS[effect]}</span>)}</div>
              {VOICE_DEFS.map((voice) => (
                <div className="send-row" key={voice.id}>
                  <span className="send-voice"><b>{voice.tag}</b>{voice.name}</span>
                  {EFFECT_IDS.map((effect) => {
                    const send = value.sends[voice.id][effect];
                    return <SendControl key={effect} label={`${voice.name} ${EFFECT_LABELS[effect]} send`} value={send} onChange={(next) => updateSend(voice.id, effect, next)} />;
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EffectCard({ id, enabled, onEnabledChange, children }: {
  id: EffectId;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return <fieldset className="effect-card" data-enabled={enabled || undefined}>
    <legend>{EFFECT_LABELS[id]}</legend>
    <button type="button" className="effect-enable" aria-label={`${enabled ? "Disable" : "Enable"} ${EFFECT_LABELS[id].toLowerCase()}`} aria-pressed={enabled} onClick={() => onEnabledChange(!enabled)}>{enabled ? "On" : "Off"}</button>
    <div className="effect-card-controls">{children}</div>
  </fieldset>;
}

function EffectParameter({ label, min, max, step = 1, value, suffix, onChange }: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const inputId = useId();
  return <div className="effect-parameter">
    <span><label htmlFor={inputId}>{label}</label><output htmlFor={inputId}>{value}{suffix}</output></span>
    <input id={inputId} className="range" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </div>;
}

function SendControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const inputId = useId();
  return <div className="send-control">
    <label className="sr-only" htmlFor={inputId}>{label}</label>
    <input id={inputId} className="range" type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    <output htmlFor={inputId}>{value === 0 ? "off" : `${value}%`}</output>
  </div>;
}
