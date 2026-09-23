import { useId } from "react";
import { applyVoicePreset, matchingVoicePreset, VOICE_PRESETS } from "@/lib/voice-presets";
import type { VoiceId, VoiceState } from "@/lib/types";

export function VoicePresetSelect({ voiceId, voiceName, value, onChange }: {
  voiceId: VoiceId; voiceName: string; value: VoiceState; onChange: (value: VoiceState) => void;
}) {
  const id = useId();
  const selected = matchingVoicePreset(voiceId, value.custom);
  return <div className="voice-preset">
    <div className="voice-select-field">
      <label htmlFor={id}>Sound preset</label>
      <select id={id} className="control" aria-label={`${voiceName} Sound preset`} value={selected?.id ?? ""} aria-describedby={`${id}-description ${id}-scope`} onChange={(event) => onChange(applyVoicePreset(voiceId, value, event.target.value))}>
        <option value="" disabled>Custom settings</option>
        {VOICE_PRESETS[voiceId].map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
      </select>
    </div>
    <p id={`${id}-description`}>{selected?.description ?? "Your own synthesis settings. Choose a preset for a new starting point."}</p>
    <p id={`${id}-scope`}>Changes synthesis only. Keeps tuning, decay, mix, routing and synth key/scale.</p>
  </div>;
}
