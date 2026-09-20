import { VOICE_DEFS } from "@/lib/constants";
import type { VoiceBank as VoiceBankState, VoiceId, VoiceState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VoiceBankProps {
  voices: VoiceBankState;
  activeVoices: Partial<Record<VoiceId, boolean>>;
  onChange: (id: VoiceId, voice: VoiceState) => void;
  changedFields?: Partial<Record<VoiceId, ReadonlySet<keyof VoiceState>>>;
}

export function VoiceBank({ voices, activeVoices, onChange, changedFields = {} }: VoiceBankProps) {
  return (
    <div className="voice-bank">
      {VOICE_DEFS.map((definition) => {
        const voice = voices[definition.id];
        const update = <K extends keyof VoiceState>(key: K, value: VoiceState[K]) => onChange(definition.id, { ...voice, [key]: value });
        return (
          <section key={definition.id} className={cn("voice-row", voice.mute && "opacity-45", changedFields[definition.id]?.size && "has-variation-change")}>
            <div className="voice-heading">
              <span className={cn("voice-led", activeVoices[definition.id] && "active")} />
              <abbr className="voice-tag-badge" title={`Roland voice code for ${definition.name}`}>{definition.tag}</abbr>
              <span className="voice-name">{definition.name}</span>
              <button
                type="button"
                className={cn("model-button", voice.machine === "909" && "is-909", changedFields[definition.id]?.has("machine") && "variation-changed")}
                onClick={() => update("machine", voice.machine === "808" ? "909" : "808")}
                aria-label={`Use ${voice.machine === "808" ? "909" : "808"} ${definition.name}`}
              >
                {voice.machine}
              </button>
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
