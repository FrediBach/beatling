import { ChevronDown, Dices, Lock, LockOpen, Volume2, VolumeX } from "lucide-react";
import { VOICE_DEFS, blockTag, padBlock } from "@/lib/constants";
import type { BlockKind, SequencerBlock, VoiceId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SequencerHeadingProps {
  index: number;
  block: SequencerBlock;
  blockLocked: boolean;
  changedFields: ReadonlySet<keyof SequencerBlock>;
  onChange: (block: SequencerBlock) => void;
  onRandomize: () => void;
  onLockToggle: () => void;
}

export function SequencerHeading({ index, block, blockLocked, changedFields, onChange, onRandomize, onLockToggle }: SequencerHeadingProps) {
  const update = <K extends keyof SequencerBlock>(key: K, value: SequencerBlock[K]) => onChange({ ...block, [key]: value });
  const selection = block.kind === "voice" ? block.voice : block.kind;
  const selectKind = (value: string) => {
    if (value === "modulator" || value === "bernoulli") onChange({ ...block, kind: value as BlockKind, voice: "" });
    else onChange({ ...block, kind: "voice", voice: value as VoiceId });
  };
  return (
      <header className="card-heading">
        <span className="block-number">{padBlock(index)}</span>
        <div className={cn("voice-select", changedFields.has("voice") && "variation-changed")}>
          <select aria-label={`Block type or voice for block ${padBlock(index)}`} value={selection} onChange={(event) => selectKind(event.target.value)}>
            <option value="modulator">Modulator</option>
            <option value="bernoulli">Bernoulli gate</option>
            {VOICE_DEFS.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
          {block.kind !== "modulator" && <abbr className="voice-tag-badge" title={block.kind === "bernoulli" ? "Euclidean A/B voice router" : `Roland voice code for ${VOICE_DEFS.find((voice) => voice.id === block.voice)?.name}`}>{blockTag(block)}</abbr>}
          <ChevronDown size={11} />
        </div>
        <div className="card-tools">
          <button type="button" className="card-tool-button" aria-label={`Randomize block ${padBlock(index)}`} title="Randomize unlocked settings" disabled={blockLocked} onClick={onRandomize}><Dices size={12} /></button>
          <button type="button" className="card-tool-button lock-button" aria-label={`${blockLocked ? "Unlock" : "Lock"} all settings in block ${padBlock(index)}`} aria-pressed={blockLocked} title={blockLocked ? "Unlock all settings in this block" : "Lock all settings in this block"} onClick={onLockToggle}>{blockLocked ? <Lock size={11} /> : <LockOpen size={11} />}</button>
        </div>
        <button type="button" className={cn("mute-button", changedFields.has("mute") && "variation-changed")} aria-label={`${block.mute ? "Unmute" : "Mute"} block ${padBlock(index)}`} aria-pressed={block.mute} onClick={() => update("mute", !block.mute)}>
          {block.mute ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </header>
  );
}
