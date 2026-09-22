import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Settings2, Volume2, VolumeX } from "lucide-react";
import { VOICE_DEFS } from "@/lib/constants";
import { VoiceRange } from "@/components/voice-range";
import { VoiceEditorDialog } from "@/components/voice-editor-dialog";
import { VoiceModulationDialog } from "@/components/voice-modulation-dialog";
import { RoutingPorts } from "@/components/sequencer-routing";
import { effectiveVoiceModulation } from "@/lib/modulation";
import type { Connection } from "@/lib/routing";
import type { SequencerBlock, VoiceBank as VoiceBankState, VoiceId, VoiceState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hasSoloedVoices, isVoiceAudible } from "@/lib/voice-audibility";

interface VoiceBankProps {
  voices: VoiceBankState;
  activeVoices: Partial<Record<VoiceId, boolean>>;
  onChange: (id: VoiceId, voice: VoiceState) => void;
  changedFields?: Partial<Record<VoiceId, ReadonlySet<keyof VoiceState>>>;
  blocks: SequencerBlock[];
  connections: Connection[];
  lfoValues: number[];
}

const SETTINGS_FIELDS: Array<keyof VoiceState> = ["custom", "tune", "decay"];

export function VoiceBank({ voices, activeVoices, onChange, changedFields = {}, blocks, connections, lfoValues }: VoiceBankProps) {
  const [editingVoice, setEditingVoice] = useState<VoiceId | null>(null);
  const [routingVoice, setRoutingVoice] = useState<VoiceId | null>(null);
  const settingsTrigger = useRef<HTMLButtonElement | null>(null);
  const soloActive = useMemo(() => hasSoloedVoices(voices), [voices]);
  const incomingByVoice = useMemo(() => {
    const grouped = new Map<VoiceId, Connection[]>();
    for (const connection of connections) {
      if (typeof connection.target !== "string") continue;
      const incoming = grouped.get(connection.target) ?? [];
      incoming.push(connection);
      grouped.set(connection.target, incoming);
    }
    return grouped;
  }, [connections]);
  const machineAfter = { "808": "909", "909": "custom", custom: "808" } as const;
  return (
    <>
      <div className="voice-bank">
        {VOICE_DEFS.map((definition) => {
          const voice = voices[definition.id];
          const update = <K extends keyof VoiceState>(key: K, value: VoiceState[K]) => onChange(definition.id, { ...voice, [key]: value });
          const nextMachine = machineAfter[voice.machine];
          const incoming = incomingByVoice.get(definition.id) ?? [];
          const effective = effectiveVoiceModulation(voice, (source) => lfoValues[source] ?? 0.5);
          return (
            <section key={definition.id} className={cn("voice-row", !isVoiceAudible(voices, definition.id, soloActive) && "is-muted", changedFields[definition.id]?.size && "has-variation-change")} aria-label={`${definition.name} voice`} data-routing-node data-voice-id={definition.id}>
              <div className="voice-heading">
                <span className={cn("voice-led", activeVoices[definition.id] && "active")} />
                <abbr className="voice-tag-badge" title={`Roland voice code for ${definition.name}`}>{definition.tag}</abbr>
                <span className="voice-name">{definition.name}</span>
                <button
                  type="button"
                  className={cn("voice-settings", SETTINGS_FIELDS.some((field) => changedFields[definition.id]?.has(field)) && "variation-changed")}
                  aria-label={definition.model ? `Configure ${definition.name} synthesizer` : voice.machine === "custom" ? `Configure custom ${definition.name}` : `Configure ${definition.name} voice`}
                  aria-haspopup="dialog"
                  title={`Tune, decay${definition.model || voice.machine === "custom" ? ", and synthesis" : ""}`}
                  onClick={(event) => { settingsTrigger.current = event.currentTarget; setEditingVoice(definition.id); }}
                ><Settings2 size={13} /></button>
              </div>
              <div className="voice-level">
                <VoiceRange voiceName={definition.name} label="Level" min={0} max={100} value={voice.level} changed={changedFields[definition.id]?.has("level")} effectiveValue={voice.modulations.some((route) => route.destination === "level") ? voice.level * (1 + effective.level * 0.6) : undefined} onChange={(value) => update("level", value)} />
                <button
                  type="button"
                  className={cn("voice-solo", changedFields[definition.id]?.has("solo") && "variation-changed")}
                  aria-label={`${voice.solo ? "Unsolo" : "Solo"} ${definition.name} voice`}
                  aria-pressed={voice.solo}
                  onClick={() => update("solo", !voice.solo)}
                  title={`${voice.solo ? "Unsolo" : "Solo"} ${definition.name}`}
                >S</button>
                <button
                  type="button"
                  className={cn("voice-mute", changedFields[definition.id]?.has("mute") && "variation-changed")}
                  aria-label={`${voice.mute ? "Unmute" : "Mute"} ${definition.name} voice`}
                  aria-pressed={voice.mute}
                  onClick={() => update("mute", !voice.mute)}
                  title={`${voice.mute ? "Unmute" : "Mute"} ${definition.name}`}
                >{voice.mute ? <VolumeX size={13} /> : <Volume2 size={13} />}</button>
              </div>
              <div className={cn("voice-routing routing-strip", changedFields[definition.id]?.has("modulations") && "variation-changed")}>
                {definition.model ? <span className="model-button is-custom" title={`${definition.model}-inspired synthesizer`}>{definition.model}</span> : <button
                  type="button"
                  className={cn("model-button", `is-${voice.machine}`, changedFields[definition.id]?.has("machine") && "variation-changed")}
                  onClick={() => update("machine", nextMachine)}
                  aria-label={`Use ${nextMachine} ${definition.name}`}
                  title="Cycle 808, 909, and custom models"
                >
                  {voice.machine === "custom" ? "CST" : voice.machine}
                </button>}
                {incoming.length > 0 ? <RoutingPorts ownerLabel={`voice ${definition.name}`} connections={incoming} end="target" onOpen={() => setRoutingVoice(definition.id)} /> : null}
                <button type="button" className="patch-action" aria-label={`Patch ${definition.name} voice`} onClick={() => setRoutingVoice(definition.id)}>Patch <ArrowUpRight size={11} /></button>
              </div>
            </section>
          );
        })}
      </div>
      {editingVoice && (() => {
        const definition = VOICE_DEFS.find(({ id }) => id === editingVoice)!;
        const voice = voices[editingVoice];
        return <VoiceEditorDialog open onOpenChange={(open) => { if (!open) setEditingVoice(null); }} voiceId={editingVoice} voiceName={definition.name} value={voice} effective={effectiveVoiceModulation(voice, (source) => lfoValues[source] ?? 0.5)} changedFields={changedFields[editingVoice]} onChange={(next) => onChange(editingVoice, next)} onCloseAutoFocus={(event) => { event.preventDefault(); settingsTrigger.current?.focus(); }} />;
      })()}
      {routingVoice && (() => {
        const definition = VOICE_DEFS.find(({ id }) => id === routingVoice)!;
        const voice = voices[routingVoice];
        return <VoiceModulationDialog open onOpenChange={(open) => { if (!open) setRoutingVoice(null); }} voiceName={definition.name} voiceId={routingVoice} value={voice} blocks={blocks} effective={effectiveVoiceModulation(voice, (source) => lfoValues[source] ?? 0.5)} onChange={(next) => onChange(routingVoice, next)} />;
      })()}
    </>
  );
}
