import { useState } from "react";
import { Settings2 } from "lucide-react";
import { VOICE_DEFS } from "@/lib/constants";
import { VoiceEditorDialog } from "@/components/voice-editor-dialog";
import type { VoiceBank as VoiceBankState, VoiceId, VoiceState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VoiceBankProps {
  voices: VoiceBankState;
  activeVoices: Partial<Record<VoiceId, boolean>>;
  onChange: (id: VoiceId, voice: VoiceState) => void;
  changedFields?: Partial<Record<VoiceId, ReadonlySet<keyof VoiceState>>>;
}

export function VoiceBank({ voices, activeVoices, onChange, changedFields = {} }: VoiceBankProps) {
  const [editingVoice, setEditingVoice] = useState<VoiceId | null>(null);
  const machineAfter = { "808": "909", "909": "custom", custom: "808" } as const;
  return (
    <>
      <div className="voice-bank">
        {VOICE_DEFS.map((definition) => {
          const voice = voices[definition.id];
          const update = <K extends keyof VoiceState>(key: K, value: VoiceState[K]) => onChange(definition.id, { ...voice, [key]: value });
          const nextMachine = machineAfter[voice.machine];
          return (
            <section key={definition.id} className={cn("voice-row", voice.mute && "opacity-45", changedFields[definition.id]?.size && "has-variation-change")}>
              <div className="voice-heading">
                <span className={cn("voice-led", activeVoices[definition.id] && "active")} />
                <abbr className="voice-tag-badge" title={`Roland voice code for ${definition.name}`}>{definition.tag}</abbr>
                <span className="voice-name">{definition.name}</span>
                <button
                  type="button"
                  className={cn("model-button", `is-${voice.machine}`, changedFields[definition.id]?.has("machine") && "variation-changed")}
                  onClick={() => update("machine", nextMachine)}
                  aria-label={`Use ${nextMachine} ${definition.name}`}
                  title="Cycle 808, 909, and custom models"
                >
                  {voice.machine === "custom" ? "CST" : voice.machine}
                </button>
                {voice.machine === "custom" && (
                  <button
                    type="button"
                    className={cn("voice-settings", changedFields[definition.id]?.has("custom") && "variation-changed")}
                    aria-label={`Configure custom ${definition.name}`}
                    title={`Configure custom ${definition.name}`}
                    onClick={() => setEditingVoice(definition.id)}
                  ><Settings2 size={11} /></button>
                )}
                <button
                  type="button"
                  className={cn("voice-mute", changedFields[definition.id]?.has("mute") && "variation-changed")}
                  aria-label={`${voice.mute ? "Unmute" : "Mute"} ${definition.name} voice`}
                  aria-pressed={voice.mute}
                  onClick={() => update("mute", !voice.mute)}
                >M</button>
              </div>
              <div className="voice-ranges">
                <VoiceRange voiceName={definition.name} label="Level" min={0} max={100} value={voice.level} changed={changedFields[definition.id]?.has("level")} onChange={(value) => update("level", value)} />
                <VoiceRange voiceName={definition.name} label="Tune" min={-12} max={12} value={voice.tune} changed={changedFields[definition.id]?.has("tune")} display={voice.tune > 0 ? `+${voice.tune}` : String(voice.tune)} onChange={(value) => update("tune", value)} />
                <VoiceRange voiceName={definition.name} label="Decay" min={0} max={100} value={voice.decay} changed={changedFields[definition.id]?.has("decay")} onChange={(value) => update("decay", value)} />
              </div>
            </section>
          );
        })}
      </div>
      {editingVoice && (() => {
        const definition = VOICE_DEFS.find(({ id }) => id === editingVoice)!;
        const voice = voices[editingVoice];
        return <VoiceEditorDialog open onOpenChange={(open) => { if (!open) setEditingVoice(null); }} voiceId={editingVoice} voiceName={definition.name} value={voice.custom} onChange={(custom) => onChange(editingVoice, { ...voice, custom })} />;
      })()}
    </>
  );
}

function VoiceRange({ voiceName, label, min, max, value, display = String(value), changed = false, onChange }: { voiceName: string; label: string; min: number; max: number; value: number; display?: string; changed?: boolean; onChange: (value: number) => void }) {
  return (
    <label className={cn("grid grid-cols-[1fr_auto] items-center gap-x-1 text-[10px] text-muted", changed && "variation-changed")}>
      {label}<output className="font-mono text-ink">{display}</output>
      <input aria-label={`${voiceName} ${label.toLowerCase()}`} className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
