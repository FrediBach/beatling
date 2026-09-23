import { expect, it } from "vitest";
import { blockCvSampler } from "./block-cv";
import { createEmptyPatch } from "./patch";
import type { LfoFrame } from "./lfo";

it("chains quantizers and bounds cyclic pitch/modulation routes", () => {
  const { blocks } = createEmptyPatch();
  Object.assign(blocks[0], { kind: "quantizer", voice: "", steps: 12, pulses: 3, quantizerSource: "1" });
  Object.assign(blocks[1], { kind: "quantizer", voice: "", steps: 12, pulses: 4, quantizerSource: "2" });
  const frame: LfoFrame = { time: 0, position: 0, stepDuration: 1, rhythm: blocks[2], shape: "rnd", random: 0.3, euclidean: false };
  expect(blockCvSampler(blocks, 0, (index) => index === 2 ? frame : null)(0)).toBe(4 / 12);
  blocks[1].quantizerSource = "0";
  blocks[0].modulations = [{ source: "1", destination: "pulses", amount: 1 }];
  expect(Number.isFinite(blockCvSampler(blocks, 0, () => null)(0))).toBe(true);
});

it("uses captured scale modulation until the next clock frame", () => {
  const { blocks } = createEmptyPatch();
  Object.assign(blocks[0], { kind: "quantizer", steps: 12, pulses: 3, quantizerSource: "1" });
  const frames: LfoFrame[] = [
    { time: 0, position: 0, stepDuration: 1, rhythm: { steps: 12, pulses: 4, rot: 0 }, shape: "ramp", random: 0, euclidean: true },
    { time: 0, position: 0, stepDuration: 1, rhythm: blocks[1], shape: "rnd", random: 0.26, euclidean: false },
  ];
  expect(blockCvSampler(blocks, 0, (index) => frames[index])(0)).toBe(3 / 12);
  expect(blockCvSampler(blocks, 0, (index) => index === 0 ? null : frames[index])(0)).toBe(4 / 12);
});
