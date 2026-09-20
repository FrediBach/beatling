import { VOICE_DEFS } from "@/lib/constants";
import type { VoiceBank as VoiceBankState, VoiceId, VoiceState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VoiceBankProps {
  voices: VoiceBankState;
  activeVoices: Partial<Record<VoiceId, boolean>>;
  onChange: (id: VoiceId, voice: VoiceState) => void;
}

export function VoiceBank({ voices, activeVoices, onChange }: VoiceBankProps) {
  return (
    <div>
      {VOICE_DEFS.map((definition) => {
        const voice = voices[definition.id];
        const update = <K extends keyof VoiceState>(key: K, value: VoiceState[K]) => onChange(definition.id, { ...voice, [key]: value });
        return (
          <section key={definition.id} className={cn("border-b border-rule-soft py-1.5 transition-opacity", voice.mute && "opacity-45")}>
            <div className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full bg-ink opacity-15 transition-colors", activeVoices[definition.id] && "bg-signal opacity-100")} />
              <span className="flex-1 text-xs font-medium">{definition.name}</span>
              <button
                type="button"
                className={cn("rounded-sm border px-1 font-mono text-[9px] text-muted", voice.machine === "909" ? "border-ink bg-ink text-paper" : "border-rule")}
                onClick={() => update("machine", voice.machine === "808" ? "909" : "808")}
                aria-label={`Use ${voice.machine === "808" ? "909" : "808"} ${definition.name}`}
              >
                {voice.machine}
              </button>
              <button
                type="button"
                className={cn("rounded-sm border border-rule px-1 font-mono text-[9px] text-muted", voice.mute && "border-hot bg-hot text-white")}
                aria-pressed={voice.mute}
                onClick={() => update("mute", !voice.mute)}
              >M</button>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <VoiceRange label="Level" min={0} max={100} value={voice.level} onChange={(value) => update("level", value)} />
              <VoiceRange label="Tune" min={-12} max={12} value={voice.tune} display={voice.tune > 0 ? `+${voice.tune}` : String(voice.tune)} onChange={(value) => update("tune", value)} />
              <VoiceRange label="Decay" min={0} max={100} value={voice.decay} onChange={(value) => update("decay", value)} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function VoiceRange({ label, min, max, value, display = String(value), onChange }: { label: string; min: number; max: number; value: number; display?: string; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-1 text-[10px] text-muted">
      {label}<output className="font-mono text-ink">{display}</output>
      <input className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
