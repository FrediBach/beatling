import { ArrowRight, X } from "lucide-react";
import { LFO_SHAPES, VOICE_DEFS, blockName, padBlock, voiceName } from "@/lib/constants";
import type { BlockVisualState, VoiceState, ClockSource, SequencerBlock, VoiceId } from "@/lib/types";
import { connectionsFor } from "@/lib/routing";
import { ModulationScope } from "./modulation-scope";
import { ModulationEditor } from "./modulation-editor";
import { cn } from "@/lib/utils";

export function PatchPanel({ index, blocks, onChange, onSelect, onClose, visual, voice, embedded = false }: { index: number; blocks: SequencerBlock[]; onChange: (block: SequencerBlock) => void; onSelect: (index: number) => void; onClose: () => void; embedded?: boolean; visual?: BlockVisualState; voice?: VoiceState }) {
  const block = blocks[index];
  const update = <K extends keyof SequencerBlock>(key: K, value: SequencerBlock[K]) => onChange({ ...block, [key]: value });
  const connections = connectionsFor(blocks).filter((connection) => connection.source === index || connection.target === index);
  const clockSources = new Set<ClockSource>(block.clk);
  return <section className="patch-panel" aria-label={`Routing for block ${padBlock(index)}`}>
    {!embedded && <div className="panel-heading"><div><span className="eyebrow">Patch bay / {padBlock(index)}</span><h2>{blockName(block)}</h2></div><button className="icon-button" aria-label="Close patch bay" onClick={onClose}><X size={16} /></button></div>}
    <div className="patch-target"><span className="jack" /><span>Editing inputs to block <b>{padBlock(index)}</b></span></div>
    <div className="patch-editor">
          <div>
            <p className="mb-1 text-[10px] text-muted">Clock in — sources add up</p>
            <div className="clock-chips">
              <ClockChip label="G" title="Global clock" active={clockSources.has("G")} onClick={() => toggleClock("G", block, onChange)} />
              {blocks.map((_other, sourceIndex) => sourceIndex !== index && (
                <ClockChip
                  key={sourceIndex}
                  label={padBlock(sourceIndex)}
                  title={`Trigger out of block ${padBlock(sourceIndex)}`}
                  active={clockSources.has(String(sourceIndex) as ClockSource)}
                  onClick={() => toggleClock(String(sourceIndex) as ClockSource, block, onChange)}
                />
              ))}
            </div>
          </div>

          <div className="patch-fields">
            {block.kind === "bernoulli" && <>
              <PatchLabel>Output A · chance</PatchLabel>
              <BranchVoiceSelect label="Output A voice" value={block.branchVoices[0]} onChange={(voice) => update("branchVoices", [voice, voice === block.branchVoices[1] ? block.branchVoices[0] : block.branchVoices[1]])} />

              <PatchLabel>Output B · remainder</PatchLabel>
              <BranchVoiceSelect label="Output B voice" value={block.branchVoices[1]} onChange={(voice) => update("branchVoices", [voice === block.branchVoices[0] ? block.branchVoices[1] : block.branchVoices[0], voice])} />
            </>}

            <PatchLabel>Reset in</PatchLabel>
            <select aria-label="Reset source" className="control" value={block.rst} onChange={(event) => update("rst", event.target.value as SequencerBlock["rst"])}>
              <option value="">none</option>
              <option value="BAR">every bar</option>
              {blocks.map((source, sourceIndex) => sourceIndex !== index && (
                <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {source.voice ? voiceName(source.voice) : "block"}</option>
              ))}
            </select>

            <PatchLabel>Mute in</PatchLabel>
            <BlockSelect label="Mute source" value={block.mut} index={index} blocks={blocks} onChange={(value) => update("mut", value)} />

            <PatchLabel>Gate</PatchLabel>
            <RangeWithOutput label="Gate length" min={5} max={200} step={5} value={block.gate} suffix="%" onChange={(value) => update("gate", value)} />

            <PatchLabel>LFO out</PatchLabel>
            <select aria-label="LFO waveform" className="control" value={block.shape} onChange={(event) => update("shape", event.target.value as SequencerBlock["shape"])}>
              {LFO_SHAPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

          </div>
    </div>
    <ModulationScope block={block} visual={visual} />
    <ModulationEditor index={index} blocks={blocks} visual={visual} voice={voice} onChange={onChange} />
    <div className="connection-heading"><span className="eyebrow">Signal flow</span><span>{connections.length} connections</span></div>
    <div className="connection-list">
      {connections.length === 0 && <p className="empty-routing">No block connections yet. Choose a clock or modulation source above.</p>}
      {connections.map((connection) => <button className="connection" aria-label={`Block ${padBlock(connection.source)} ${connection.output} to block ${padBlock(connection.target)} ${connection.input}`} key={`${connection.source}-${connection.target}-${connection.input}`} onClick={() => onSelect(connection.source === index ? connection.target : connection.source)}>
        <span><b>{padBlock(connection.source)}</b> {connection.output}</span><ArrowRight size={13} /><span><b>{padBlock(connection.target)}</b> {connection.input}</span>
      </button>)}
    </div>
    {block.kind === "bernoulli" && <p className="patch-help">Every filled Euclidean step routes to A at the Chance percentage, or to B otherwise. No hit is discarded.</p>}
    <p className="patch-help">Trigger → clock / reset<br />Gate → mute · LFO → modulation<br /><span>Select a connection to follow its signal.</span></p>
  </section>;
}

function BranchVoiceSelect({ label, value, onChange }: { label: string; value: VoiceId; onChange: (voice: VoiceId) => void }) {
  return <select aria-label={label} className="control" value={value} onChange={(event) => onChange(event.target.value as VoiceId)}>
    {VOICE_DEFS.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
  </select>;
}

function ClockChip({ label, title, active, onClick }: { label: string; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      className={cn("flex h-[18px] w-5 items-center justify-center rounded-sm border font-mono text-[9px]", active ? "border-signal bg-signal text-white" : "border-rule text-muted hover:border-ink")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function toggleClock(source: ClockSource, block: SequencerBlock, onChange: (block: SequencerBlock) => void) {
  const clk = block.clk.includes(source) ? block.clk.filter((item) => item !== source) : [...block.clk, source];
  onChange({ ...block, clk });
}

function PatchLabel({ children }: { children: React.ReactNode }) {
  return <span className="patch-label">{children}</span>;
}

function BlockSelect({ label, value, index, blocks, onChange }: { label: string; value: SequencerBlock["mut"]; index: number; blocks: SequencerBlock[]; onChange: (value: SequencerBlock["mut"]) => void }) {
  return (
    <select aria-label={label} className="control" value={value} onChange={(event) => onChange(event.target.value as SequencerBlock["mut"])}>
      <option value="">none</option>
      {blocks.map((source, sourceIndex) => sourceIndex !== index && (
        <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {source.voice ? voiceName(source.voice) : "block"}</option>
      ))}
    </select>
  );
}

function RangeWithOutput({ label, min, max, step = 1, value, suffix, onChange }: { label: string; min: number; max: number; step?: number; value: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input aria-label={label} className="range min-w-0 flex-1" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output className="w-9 text-right font-mono text-[10px] text-muted">{value}{suffix}</output>
    </div>
  );
}
