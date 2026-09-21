import { useId, useState } from "react";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { VOICE_DEFS } from "@/lib/constants";
import { VoiceEditorDialog } from "@/components/voice-editor-dialog";
import { VoiceModulationDialog } from "@/components/voice-modulation-dialog";
import { RoutingPorts } from "@/components/sequencer-routing";
import { effectiveVoiceModulation } from "@/lib/modulation";
import type { Connection } from "@/lib/routing";
import type { SequencerBlock, VoiceBank as VoiceBankState, VoiceId, VoiceState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VoiceBankProps {
  voices: VoiceBankState;
  activeVoices: Partial<Record<VoiceId, boolean>>;
  onChange: (id: VoiceId, voice: VoiceState) => void;
  changedFields?: Partial<Record<VoiceId, ReadonlySet<keyof VoiceState>>>;
  blocks: SequencerBlock[];
  connections: Connection[];
  lfoValues: number[];
}

export function VoiceBank({ voices, activeVoices, onChange, changedFields = {}, blocks, connections, lfoValues }: VoiceBankProps) {
  const [editingVoice, setEditingVoice] = useState<VoiceId | null>(null);
  const [routingVoice, setRoutingVoice] = useState<VoiceId | null>(null);
  const machineAfter = { "808": "909", "909": "custom", custom: "808" } as const;
  return (
    <>
      <div className="voice-bank">
        {VOICE_DEFS.map((definition) => {
          const voice = voices[definition.id];
          const update = <K extends keyof VoiceState>(key: K, value: VoiceState[K]) => onChange(definition.id, { ...voice, [key]: value });
          const nextMachine = machineAfter[voice.machine];
          const incoming = connections.filter((connection) => connection.target === definition.id);
          const effective = effectiveVoiceModulation(voice, (source) => lfoValues[source] ?? 0.5);
          return (
            <section key={definition.id} className={cn("voice-row", voice.mute && "opacity-45", changedFields[definition.id]?.size && "has-variation-change")} data-routing-node data-voice-id={definition.id}>
              <div className="voice-heading">
                <span className={cn("voice-led", activeVoices[definition.id] && "active")} />
                <abbr className="voice-tag-badge" title={`Roland voice code for ${definition.name}`}>{definition.tag}</abbr>
                <span className="voice-name">{definition.name}</span>
                {definition.model ? <span className="model-button is-custom" title={`${definition.model}-inspired synthesizer`}>{definition.model}</span> : <button
                  type="button"
                  className={cn("model-button", `is-${voice.machine}`, changedFields[definition.id]?.has("machine") && "variation-changed")}
                  onClick={() => update("machine", nextMachine)}
                  aria-label={`Use ${nextMachine} ${definition.name}`}
                  title="Cycle 808, 909, and custom models"
                >
                  {voice.machine === "custom" ? "CST" : voice.machine}
                </button>}
                {(definition.model || voice.machine === "custom") && (
                  <button
                    type="button"
                    className={cn("voice-settings", changedFields[definition.id]?.has("custom") && "variation-changed")}
                    aria-label={definition.model ? `Configure ${definition.name} synthesizer` : `Configure custom ${definition.name}`}
                    title={definition.model ? `Configure ${definition.model}-inspired ${definition.name.toLowerCase()}` : `Configure custom ${definition.name}`}
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
                <VoiceRange voiceName={definition.name} label="Level" min={0} max={100} value={voice.level} changed={changedFields[definition.id]?.has("level")} display={displayModulated(voice.level, voice.level * (1 + effective.level * 0.6), voice.modulations.some((route) => route.destination === "level"))} onChange={(value) => update("level", value)} />
                <VoiceRange voiceName={definition.name} label="Tune" min={-12} max={12} value={voice.tune} changed={changedFields[definition.id]?.has("tune")} display={displayModulated(voice.tune, voice.tune + effective.tune * 12, voice.modulations.some((route) => route.destination === "tune"), true)} onChange={(value) => update("tune", value)} />
                <VoiceRange voiceName={definition.name} label="Decay" min={0} max={100} value={voice.decay} changed={changedFields[definition.id]?.has("decay")} display={displayModulated(voice.decay, voice.decay + effective.decay * 50, voice.modulations.some((route) => route.destination === "decay"))} onChange={(value) => update("decay", value)} />
              </div>
              <div className={cn("voice-routing routing-strip", changedFields[definition.id]?.has("modulations") && "variation-changed")}>
                {incoming.length > 0 ? <RoutingPorts ownerLabel={`voice ${definition.name}`} connections={incoming} end="target" onOpen={() => setRoutingVoice(definition.id)} /> : <span className="route-summary">No modulation</span>}
                <button type="button" className="patch-action" aria-label={`Patch ${definition.name} voice`} onClick={() => setRoutingVoice(definition.id)}>Patch <ArrowUpRight size={11} /></button>
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
      {routingVoice && (() => {
        const definition = VOICE_DEFS.find(({ id }) => id === routingVoice)!;
        const voice = voices[routingVoice];
        return <VoiceModulationDialog open onOpenChange={(open) => { if (!open) setRoutingVoice(null); }} voiceName={definition.name} voiceId={routingVoice} value={voice} blocks={blocks} effective={effectiveVoiceModulation(voice, (source) => lfoValues[source] ?? 0.5)} onChange={(next) => onChange(routingVoice, next)} />;
      })()}
    </>
  );
}

function displayModulated(base: number, effective: number, modulated: boolean, signed = false) {
  const format = (value: number) => `${signed && value > 0 ? "+" : ""}${Math.round(value)}`;
  return modulated ? `${format(base)}→${format(effective)}` : format(base);
}

function VoiceRange({ voiceName, label, min, max, value, display = String(value), changed = false, onChange }: { voiceName: string; label: string; min: number; max: number; value: number; display?: string; changed?: boolean; onChange: (value: number) => void }) {
  const inputId = useId();
  return (
    <div className={cn("voice-range grid grid-cols-[1fr_auto] items-center gap-x-1 text-[10px] text-muted", changed && "variation-changed")}>
      <label htmlFor={inputId}>{label}</label><output className="font-mono text-ink">{display}</output>
      <input id={inputId} aria-label={`${voiceName} ${label.toLowerCase()}`} className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
