import { effectiveBlock } from "./euclid";
import { sampleLfo, type LfoFrame } from "./lfo";
import { quantizeEuclideanCv } from "./quantizer";
import { BLOCK_COUNT, type SequencerBlock } from "./types";

/** Sample the same graph against scheduled frames or audible display frames. */
export function blockCvSampler(blocks: SequencerBlock[], time: number, frameFor: (index: number) => LfoFrame | null | undefined) {
  const visiting = new Set<number>();
  const values = new Map<number, number>();
  let budget = BLOCK_COUNT * 8;
  const sample = (index: number): number => {
    const cached = values.get(index);
    if (cached !== undefined) return cached;
    const block = blocks[index];
    if (!block || visiting.has(index) || budget-- <= 0) return 0;
    const frame = frameFor(index);
    if (block.kind !== "quantizer") {
      const value = frame ? sampleLfo(frame, time).value : block.kind === "voice" && block.voice ? 0 : 0.5;
      values.set(index, value);
      return value;
    }
    visiting.add(index);
    const input = block.quantizerSource === "" ? 0 : sample(Number(block.quantizerSource));
    const rhythm = frame?.rhythm ?? effectiveBlock(block, sample);
    const value = quantizeEuclideanCv(rhythm, input);
    visiting.delete(index);
    values.set(index, value);
    return value;
  };
  return sample;
}
