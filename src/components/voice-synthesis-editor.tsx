import { useId } from "react";
import { EffectControl } from "./effect-control";
import { VoiceDiagram } from "./voice-diagram";
import { VOICE_EDITOR_PANELS, type VoiceEditorPanel } from "./voice-editor-layout";
import { DEFAULT_CUSTOM_VOICE_SETTINGS, VOICE_PARAMETER_SECTIONS, type VoiceParameterDefinition } from "@/lib/voice-config";
import type { CustomVoiceSettings, VoiceId } from "@/lib/types";

function controlNote(voiceId: VoiceId, key: string, v: CustomVoiceSettings): string | undefined {
  if (voiceId === "rim" && ["noiseDecay", "noiseFilter", "noiseQ"].includes(key) && v.noiseMode === 0) return "Saved for Independent mode";
  if (key === "glide" && v.playMode === 0) return "Saved for Mono retrigger";
  if (key === "chokeRelease" && v.chokeMode === 0) return "Saved for Closed hat mode";
  if (key === "pulseWidth" && v.waveform !== 1 && !(voiceId === "lead" && v.pulseMix > 0)) return "Choose Square to hear pulse width";
  if (key === "grainRate" && v.grainDepth === 0) return "Raise Grain depth to hear texture";
  if (v[key] !== 0) return;
  const follows: Record<string, string> = {
    metalDecay: "Follows the noise length", upperDecay: "Follows Body length", overtoneDecay: "Follows 45% of Length",
    tailFilter: "Follows Body filter", ampDecay: "Follows Filter decay", filterDecay: "Follows Release",
    noiseFilter: "Follows Body filter", noiseQ: "Follows Filter resonance",
  };
  return follows[key];
}

function VoiceChoices({ name, definition, value, describedBy, onChange }: { name: string; definition: VoiceParameterDefinition; value: number; describedBy: string; onChange: (value: number) => void }) {
  const options = definition.options ?? [1, 2, 3, 4, 5, 6].map((count) => ({ value: count, label: String(count) }));
  return <fieldset className="effect-choices voice-choices" aria-describedby={describedBy}>
    <legend>{definition.label}</legend>
    <div>{options.map((option) => <button type="button" key={option.value} aria-label={`${name} ${definition.label}: ${option.label}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
  </fieldset>;
}

function VoiceParameter({ voiceId, voiceName, definition, value, dial, descriptionId, onChange }: {
  voiceId: VoiceId; voiceName: string; definition: VoiceParameterDefinition; value: CustomVoiceSettings;
  dial: boolean; descriptionId: string; onChange: (key: string, value: number) => void;
}) {
  const { key, label, min, max, step, unit, options } = definition;
  const note = controlNote(voiceId, key, value);
  const describedBy = `${descriptionId}${note ? ` ${descriptionId}-note` : ""}`;
  const isSelect = options && options.length > 3;
  return <div className={`voice-parameter${dial ? " voice-parameter-dial" : ""}${options || key === "balance" || key === "burstCount" ? " voice-parameter-wide" : ""}`}>
    {isSelect ? <div className="voice-select-field">
      <label htmlFor={`${descriptionId}-select`}>{label}</label>
      <select id={`${descriptionId}-select`} className="control" aria-label={`${voiceName} ${label}`} aria-describedby={describedBy} value={value[key]} onChange={(event) => onChange(key, Number(event.target.value))}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div> : options || key === "burstCount" ? <VoiceChoices name={voiceName} definition={definition} value={value[key]} describedBy={describedBy} onChange={(next) => onChange(key, next)} /> : <>
      <EffectControl label={label} accessibleLabel={`${voiceName} ${label}`} describedBy={describedBy} value={value[key]} min={min} max={max} step={step} suffix={unit ?? ""} knob={dial} defaultValue={DEFAULT_CUSTOM_VOICE_SETTINGS[voiceId][key]} onChange={(next) => onChange(key, next)} />
      {key === "balance" && <div className="voice-blend-labels" aria-hidden="true"><span>Low only</span><span>Equal</span><span>High only</span></div>}
    </>}
    {note && <p id={`${descriptionId}-note`} className="voice-control-note">{note}</p>}
  </div>;
}

function SynthesisPanel({ panel, definitions, voiceId, voiceName, value, onChange, number }: {
  panel: VoiceEditorPanel; definitions: Map<string, VoiceParameterDefinition>; voiceId: VoiceId; voiceName: string;
  value: CustomVoiceSettings; onChange: (key: string, value: number) => void; number: number;
}) {
  const id = useId();
  const parameters = panel.keys.map((key) => definitions.get(key)!);
  return <section className="voice-design-panel" aria-labelledby={`${id}-title`}>
    <header><span aria-hidden="true">{String(number).padStart(2, "0")}</span><h3 id={`${id}-title`}>{panel.title}</h3></header>
    <p className="voice-panel-description">{panel.description}</p>
    {panel.diagram && <VoiceDiagram kind={panel.diagram} value={value} />}
    <div className="voice-panel-controls">
      {parameters.map((definition) => <VoiceParameter key={definition.key} voiceId={voiceId} voiceName={voiceName} definition={definition} value={value} dial={panel.dial === definition.key} descriptionId={`${id}-${definition.key}`} onChange={onChange} />)}
    </div>
    <details className="voice-control-guide">
      <summary>Control guide<span className="sr-only">: {panel.title}</span></summary>
      <dl>{parameters.map((definition) => <div key={definition.key}><dt>{definition.label}</dt><dd id={`${id}-${definition.key}`}>{definition.description}</dd></div>)}</dl>
    </details>
  </section>;
}

export function VoiceSynthesisEditor({ voiceId, voiceName, value, custom, onChange }: {
  voiceId: VoiceId; voiceName: string; value: CustomVoiceSettings; custom: boolean; onChange: (key: string, value: number) => void;
}) {
  const definitions = new Map(VOICE_PARAMETER_SECTIONS[voiceId].flatMap((section) => section.parameters).map((definition) => [definition.key, definition]));
  return <div className="voice-design-panels">{VOICE_EDITOR_PANELS[voiceId].filter((panel) => custom || panel.allMachines).map((panel, index) => <SynthesisPanel key={panel.title} panel={panel} definitions={definitions} voiceId={voiceId} voiceName={voiceName} value={value} onChange={onChange} number={index + 1} />)}</div>;
}
