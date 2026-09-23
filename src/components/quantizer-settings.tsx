import { blockName, padBlock } from "@/lib/constants";
import { euclideanScale, NOTE_NAMES } from "@/lib/quantizer";
import type { BlockVisualState, SequencerBlock } from "@/lib/types";

export function QuantizerSettings({ index, blocks, visual, onChange }: {
  index: number; blocks: SequencerBlock[]; visual?: BlockVisualState; onChange: (block: SequencerBlock) => void;
}) {
  const block = blocks[index];
  const rhythm = visual?.effective ?? block;
  const intervals = euclideanScale(rhythm);
  const notes = intervals.map((interval) => rhythm.steps === 12 ? NOTE_NAMES[interval] : `${Math.round(interval * 100)}¢`);
  return <section className="modulation-scope quantizer-settings" aria-label="Euclidean Quantizer settings">
    <label className="patch-label block mb-1" htmlFor={`quantizer-input-${index}`}>Pitch CV input</label>
    <select id={`quantizer-input-${index}`} className="control" value={block.quantizerSource} onChange={(event) => onChange({ ...block, quantizerSource: event.target.value as SequencerBlock["quantizerSource"] })}>
      <option value="">None · 0 V</option>
      {blocks.map((source, sourceIndex) => sourceIndex !== index && <option key={sourceIndex} value={sourceIndex}>{padBlock(sourceIndex)} {blockName(source)}</option>)}
    </select>
    <p className="patch-help">Steps divides one octave; Fill selects evenly spaced pitches and Rotate shifts them. Use 12 steps for semitones. Fill 0 passes CV through. Clock and Divide advance the scale series and sample its modulation; Chance and Mute affect trigger/gate outputs only.</p>
    <p className="patch-help"><b>Scale relative to C:</b> <output aria-label="Euclidean scale">{notes.length ? notes.join(" · ") : "Bypass"}</output><br /><b>CV output:</b> <output aria-label="Quantizer CV output">{(visual?.lfo ?? 0).toFixed(3)} V</output></p>
    <p className="patch-help">In a synth’s Patch dialog, choose this block for V/Oct at 100% depth. Set the voice’s Quantizer to Off to keep this scale. Root, octave and Tune transpose the result.</p>
  </section>;
}
