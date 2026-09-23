import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createCustomVoiceSettings } from "@/lib/voice-config";
import { SYNTH_VOICE_IDS } from "@/lib/constants";
import { VoiceSynthesisEditor } from "@/components/voice-synthesis-editor";
import { VoicePresetSelect } from "@/components/voice-preset-select";
import "./voice-editor.css";
import { VoiceRange } from "@/components/voice-range";
import type { EffectiveVoiceModulation, VoiceId, VoiceState } from "@/lib/types";

interface VoiceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceId: VoiceId;
  voiceName: string;
  value: VoiceState;
  effective: EffectiveVoiceModulation;
  changedFields?: ReadonlySet<keyof VoiceState>;
  onChange: (value: VoiceState) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function VoiceEditorDialog({ open, onOpenChange, voiceId, voiceName, value, effective, changedFields, onChange, onCloseAutoFocus }: VoiceEditorDialogProps) {
  const hasSynthControls = SYNTH_VOICE_IDS.has(voiceId) || value.machine === "custom";
  const update = (key: string, next: number) => onChange({ ...value, custom: { ...value.custom, [key]: next } });
  const modulatedTargets = new Set(value.modulations.map((route) => route.destination));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`voice-editor-dialog${hasSynthControls ? " voice-editor-custom" : ""}`} aria-describedby={`voice-editor-description-${voiceId}`} onCloseAutoFocus={onCloseAutoFocus}>
        <header className="voice-editor-header">
          <div>
            <span className="eyebrow">Voice settings / {voiceId.toUpperCase()}</span>
            <DialogTitle>{voiceName} {hasSynthControls ? "synthesizer" : "settings"}</DialogTitle>
            <DialogDescription id={`voice-editor-description-${voiceId}`}>
              Adjust tuning and decay{voiceId === "oh" ? ", set hi-hat choking" : ""}{hasSynthControls ? ` and shape the ${voiceName.toLowerCase()} synthesis circuit` : ` for the ${value.machine} ${voiceName.toLowerCase()}`}. Changes apply as you play.
            </DialogDescription>
          </div>
          {hasSynthControls && <Button type="button" variant="outline" onClick={() => onChange({ ...value, custom: createCustomVoiceSettings(voiceId) })}>
            <RotateCcw size={13} />Reset synthesis
          </Button>}
        </header>
        <div className="voice-editor-sections">
          {hasSynthControls && <VoicePresetSelect voiceId={voiceId} voiceName={voiceName} value={value} onChange={onChange} />}
          <fieldset className="voice-editor-section">
            <legend>Overall tuning &amp; decay</legend>
            <div className="voice-editor-controls voice-tone-controls">
              <VoiceRange voiceName={voiceName} label="Tune" min={-12} max={12} value={value.tune} signed changed={changedFields?.has("tune")} effectiveValue={modulatedTargets.has("tune") ? value.tune + effective.tune * 12 : undefined} onChange={(tune) => onChange({ ...value, tune })} />
              <VoiceRange voiceName={voiceName} label="Decay" min={0} max={100} value={value.decay} changed={changedFields?.has("decay")} effectiveValue={modulatedTargets.has("decay") ? value.decay + effective.decay * 50 : undefined} onChange={(decay) => onChange({ ...value, decay })} />
            </div>
            <p className="voice-tone-note">Tune in semitones · Decay from short to long</p>
          </fieldset>
          <VoiceSynthesisEditor voiceId={voiceId} voiceName={voiceName} value={value.custom} custom={hasSynthControls} onChange={update} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
