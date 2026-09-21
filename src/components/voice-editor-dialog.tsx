import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VOICE_PARAMETER_SECTIONS, createCustomVoiceSettings } from "@/lib/voice-config";
import type { CustomVoiceSettings, VoiceId } from "@/lib/types";

interface VoiceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceId: VoiceId;
  voiceName: string;
  value: CustomVoiceSettings;
  onChange: (value: CustomVoiceSettings) => void;
}

export function VoiceEditorDialog({ open, onOpenChange, voiceId, voiceName, value, onChange }: VoiceEditorDialogProps) {
  const sections = VOICE_PARAMETER_SECTIONS[voiceId];
  const update = (key: string, next: number) => onChange({ ...value, [key]: next });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="voice-editor-dialog" aria-describedby={`voice-editor-description-${voiceId}`}>
        <header className="voice-editor-header">
          <div>
            <span className="eyebrow">Custom voice / {voiceId.toUpperCase()}</span>
            <DialogTitle>{voiceName} synthesizer</DialogTitle>
            <DialogDescription id={`voice-editor-description-${voiceId}`}>
              Shape the {voiceName.toLowerCase()} synthesis circuit. Level, tune, and decay remain available in the voice bank.
            </DialogDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => onChange(createCustomVoiceSettings(voiceId))}>
            <RotateCcw size={13} />Reset voice
          </Button>
        </header>
        <div className="voice-editor-sections">
          {sections.map((section) => (
            <fieldset key={section.title} className="voice-editor-section">
              <legend>{section.title}</legend>
              <div className="voice-editor-controls">
                {section.parameters.map((definition) => (
                  <VoiceParameter
                    key={definition.key}
                    voiceName={voiceName}
                    definition={definition}
                    value={value[definition.key]}
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
