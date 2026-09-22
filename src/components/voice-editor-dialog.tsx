import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VOICE_PARAMETER_SECTIONS, createCustomVoiceSettings } from "@/lib/voice-config";
import { SYNTH_VOICE_IDS } from "@/lib/constants";
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
  const sections = VOICE_PARAMETER_SECTIONS[voiceId];
  const hasSynthControls = SYNTH_VOICE_IDS.has(voiceId) || value.machine === "custom";
  const update = (key: string, next: number) => onChange({ ...value, custom: { ...value.custom, [key]: next } });
  const modulatedTargets = new Set(value.modulations.map((route) => route.destination));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="voice-editor-dialog" aria-describedby={`voice-editor-description-${voiceId}`} onCloseAutoFocus={onCloseAutoFocus}>
        <header className="voice-editor-header">
          <div>
            <span className="eyebrow">Voice settings / {voiceId.toUpperCase()}</span>
            <DialogTitle>{voiceName} {hasSynthControls ? "synthesizer" : "settings"}</DialogTitle>
            <DialogDescription id={`voice-editor-description-${voiceId}`}>
              Adjust tuning and decay{voiceId === "oh" ? ", set hi-hat choking" : ""}{hasSynthControls ? ` and shape the ${voiceName.toLowerCase()} synthesis circuit` : ` for the ${value.machine} ${voiceName.toLowerCase()}`}. Level and mute remain in the voice bank. Changes apply as you play.
            </DialogDescription>
          </div>
          {hasSynthControls && <Button type="button" variant="outline" onClick={() => onChange({ ...value, custom: createCustomVoiceSettings(voiceId) })}>
            <RotateCcw size={13} />Reset synthesis
          </Button>}
        </header>
        <div className="voice-editor-sections">
          <fieldset className="voice-editor-section">
            <legend>Tuning &amp; envelope</legend>
            <div className="voice-editor-controls voice-tone-controls">
              <VoiceRange voiceName={voiceName} label="Tune" min={-12} max={12} value={value.tune} signed changed={changedFields?.has("tune")} effectiveValue={modulatedTargets.has("tune") ? value.tune + effective.tune * 12 : undefined} onChange={(tune) => onChange({ ...value, tune })} />
              <VoiceRange voiceName={voiceName} label="Decay" min={0} max={100} value={value.decay} changed={changedFields?.has("decay")} effectiveValue={modulatedTargets.has("decay") ? value.decay + effective.decay * 50 : undefined} onChange={(decay) => onChange({ ...value, decay })} />
            </div>
            <p className="voice-tone-note">Tune in semitones · Decay from short to long</p>
          </fieldset>
          {sections.filter((section) => hasSynthControls || section.allMachines).map((section) => (
            <fieldset key={section.title} className="voice-editor-section">
              <legend>{section.title}</legend>
              <div className="voice-editor-controls">
                {section.parameters.map((definition) => (
                  <VoiceParameter
                    key={definition.key}
                    voiceName={voiceName}
                    definition={definition}
                    value={value.custom[definition.key]}
                    onChange={(next) => update(definition.key, next)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VoiceParameter({ voiceName, definition, value, onChange }: {
  voiceName: string;
  definition: (typeof VOICE_PARAMETER_SECTIONS)[VoiceId][number]["parameters"][number];
  value: number;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(definition.max, Math.max(definition.min, next));
  return (
    <div className="voice-editor-control">
      <span>{definition.label}<small>{definition.description}</small></span>
      <div>
        {definition.options ? <select
          className="control voice-editor-select"
          value={value}
          aria-label={`${voiceName} ${definition.label}`}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {definition.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select> : <><input
          className="range"
          type="range"
          min={definition.min}
          max={definition.max}
          step={definition.step}
          value={value}
          aria-label={`${voiceName} ${definition.label}`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="voice-editor-value">
          <input
            type="number"
            min={definition.min}
            max={definition.max}
            step={definition.step}
            value={value}
            aria-label={`${voiceName} ${definition.label} value`}
            onChange={(event) => {
              const next = event.currentTarget.valueAsNumber;
              if (Number.isFinite(next)) onChange(clamp(next));
            }}
          />
          {definition.unit && <i>{definition.unit}</i>}
        </span></>}
      </div>
    </div>
  );
}
