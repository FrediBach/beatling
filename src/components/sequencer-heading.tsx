import { ChevronDown, Dices, Lock, LockOpen, Volume2, VolumeX } from "lucide-react";
import { VOICE_DEFS, padBlock, voiceTag } from "@/lib/constants";
import type { SequencerBlock } from "@/lib/types";
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
  return (
      <header className="card-heading">
        <span className="block-number">{padBlock(index)}</span>
        <div className={cn("voice-select", changedFields.has("voice") && "variation-changed")}>
          <select aria-label={`Voice for block ${padBlock(index)}`} value={block.voice} onChange={(event) => update("voice", event.target.value as SequencerBlock["voice"])}>
            <option value="">Modulator</option>
            {VOICE_DEFS.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
          {block.voice && <abbr className="voice-tag-badge" title={`Roland voice code for ${VOICE_DEFS.find((voice) => voice.id === block.voice)?.name}`}>{voiceTag(block.voice)}</abbr>}
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
