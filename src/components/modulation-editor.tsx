import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { blockName, padBlock } from "@/lib/constants";
import { MODULATION_TARGETS, signedAmount, targetValue } from "@/lib/modulation";
import type { BlockVisualState, ModulationRoute, SequencerBlock, VoiceState } from "@/lib/types";

interface ModulationEditorProps {
  index: number;
  blocks: SequencerBlock[];
  visual?: BlockVisualState;
  voice?: VoiceState;
  onChange: (block: SequencerBlock) => void;
}

export function ModulationEditor({ index, blocks, visual, voice, onChange }: ModulationEditorProps) {
  const block = blocks[index];
  const focusDestination = useRef<ModulationRoute["destination"] | null>(null);
  const focusAddButton = useRef(false);
  const used = new Set(block.modulations.map((route) => route.destination));
  const available = MODULATION_TARGETS.filter(([destination]) => !used.has(destination));
  const update = (destination: ModulationRoute["destination"], next: ModulationRoute) => onChange({ ...block, modulations: block.modulations.map((route) => route.destination === destination ? next : route) });
  return <section className="modulation-editor" aria-label="Modulation targets">
    <div className="modulation-heading"><span className="eyebrow">Modulation in</span><span>{block.modulations.length} / 7 targets</span></div>
    <p className="modulation-intro">Choose a source LFO, then a setting to move. Each target has its own depth.</p>
    {block.modulations.map((route) => {
      const label = MODULATION_TARGETS.find(([destination]) => destination === route.destination)?.[1] ?? route.destination;
      const live = visual && visual.position >= 0 && route.source !== "" ? visual.effective : undefined;
      return <fieldset className="modulation-route" key={route.destination}>
        <legend>{label}</legend>
        <div className="modulation-route-top">
          <select className="control" aria-label={`Modulation source for ${label}`} value={route.source} onChange={(event) => update(route.destination, { ...route, source: event.target.value as ModulationRoute["source"] })}>
            <option value="">Choose source…</option>
            {blocks.map((source, sourceIndex) => sourceIndex !== index && <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {blockName(source)}</option>)}
          </select>
          <span aria-hidden="true">→</span>
          <select ref={(node) => { if (node && focusDestination.current === route.destination) { node.focus(); focusDestination.current = null; } }} className="control" aria-label={`Modulation destination for ${label}`} value={route.destination} onChange={(event) => { const destination = event.target.value as ModulationRoute["destination"]; focusDestination.current = destination; update(route.destination, { ...route, destination }); }}>
            {MODULATION_TARGETS.map(([destination, name]) => <option key={destination} value={destination} disabled={used.has(destination) && destination !== route.destination}>{name}</option>)}
          </select>
          <button type="button" className="icon-button" aria-label={`Remove ${label} modulation`} onClick={() => { focusAddButton.current = true; onChange({ ...block, modulations: block.modulations.filter((item) => item.destination !== route.destination) }); }}><X size={12} /></button>
        </div>
        <div className="modulation-depth"><span>Depth</span><input type="range" className="range" min={-100} max={100} value={Math.round(route.amount * 100)} aria-label={`Modulation amount for ${label}`} onChange={(event) => update(route.destination, { ...route, amount: Number(event.target.value) / 100 })} /><output>{signedAmount(route.amount)}</output></div>
        <div className="modulation-result"><span>{label} <b>{targetValue(route.destination, block, voice)}</b><span aria-hidden="true"> → </span><b>{targetValue(route.destination, block, voice, live)}</b></span><span>{route.source === "" ? "Select a source" : route.amount === 0 ? "Depth is zero" : live ? "Live" : "Base → live"}</span></div>
        {route.source !== "" && blocks[Number(route.source)].clk.length === 0 && <p className="modulation-note">Source {padBlock(Number(route.source))} has no clock. Enable its G clock to move the LFO.</p>}
        {block.kind === "modulator" && ["tune", "decay", "level"].includes(route.destination) && <p className="modulation-note">Assign a voice or Bernoulli gate to this block to hear this target.</p>}
        {block.kind === "bernoulli" && ["tune", "decay", "level"].includes(route.destination) && <p className="modulation-note">Both Bernoulli outputs receive this modulation; the displayed base value uses output A.</p>}
      </fieldset>;
    })}
    <button ref={(node) => { if (node && focusAddButton.current) { node.focus(); focusAddButton.current = false; } }} type="button" className="add-modulation" disabled={available.length === 0} onClick={() => onChange({ ...block, modulations: [...block.modulations, { source: block.modulations[0]?.source ?? "", destination: available[0][0], amount: 0.5 }] })}><Plus size={12} />Add modulation target</button>
    <details className="modulation-guide">
      <summary>How to set up modulation</summary>
      <ol><li>Pick a source block. Every block has an LFO; choose Modulator as its voice for a silent source.</li><li>On the source, enable G under Clock in and choose an LFO waveform. On a Modulator, Steps sets the pattern length, Fill sets the number of waveform cycles, and Rotate shifts their starts. Each wave stretches to the next filled step; Divide slows the incoming clock. Fill 0 gives no modulation.</li><li>Open Patch on the receiving block. Add a target, choose the source, and adjust Depth. Reuse a source for several targets or choose different sources.</li><li>Press Play. Purple depths show the assignment; the value beside the base value shows the result.</li></ol>
      <p>The LFO moves above and below the base value. Negative depth reverses the direction. At 100%: fill ±8, rotate ±one cycle, chance ±100 points, divide ±4, tune ±12 semitones, decay ±50 points, level ±60% of its base. Values stay within their playable limits.</p>
      <p>Modulators move continuously between source clocks. Random chooses a value at each filled step and holds it until the next. Chance, Gate and mute control the block’s trigger/gate outputs; the LFO follows the Euclidean pattern. Blocks assigned a drum voice retain their stepped LFO. Targets sample the source when the receiving block advances; voice targets affect this block’s hits.</p>
    </details>
  </section>;
}
