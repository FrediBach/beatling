import { expect, it, vi } from "vitest";
import { SequencerEngine } from "./engine";
import { createEmptyPatch } from "@/lib/patch";

function fixture() {
  const patch = createEmptyPatch();
  patch.blocks.forEach((block) => { block.clk = []; });
  // A stepped ramp feeds a quantizer, then the shared synth pitch input.
  Object.assign(patch.blocks[0], { kind: "voice", voice: "kick", steps: 12, pulses: 0, clk: ["G"] });
  Object.assign(patch.blocks[1], { kind: "quantizer", voice: "", steps: 12, pulses: 3, quantizerSource: "0", clk: ["G"] });
  Object.assign(patch.blocks[2], { kind: "voice", voice: "lead", steps: 1, pulses: 1, clk: ["G"] });
  Object.assign(patch.voices.lead.custom, { root: 0, octave: 3, scale: 1, quantizer: 0 });
  patch.voices.lead.modulations = [{ source: "1", destination: "vOct", amount: 1 }];
  const engine = new SequencerEngine(patch);
  const runtime = engine as unknown as {
    context: AudioContext | null;
    tick: (time: number, pulse: number) => void;
    lead: (time: number, parameters: { frequency: number }) => void;
  };
  const context = { currentTime: 0, sampleRate: 48000 };
  runtime.context = context as AudioContext;
  const lead = vi.spyOn(runtime, "lead").mockImplementation(() => undefined);
  const midi = () => lead.mock.calls.map(([, p]) => Math.round((69 + 12 * Math.log2(p.frequency / 440)) * 1000) / 1000);
  const destroy = () => { runtime.context = null; engine.destroy(); };
  return { patch, engine, runtime, context, midi, destroy };
}

it("plays Euclidean pitches without a second scale snap, including pitches outside Major", () => {
  const f = fixture();
  try {
    for (let pulse = 0; pulse < 12; pulse++) f.runtime.tick(pulse, pulse);
    expect(f.midi()).toEqual([48, 48, 48, 52, 52, 52, 52, 56, 56, 56, 56, 60]);
    // Restoring the voice quantizer snaps G-sharp down to G in C major.
    f.patch.voices.lead.custom.quantizer = 1;
    f.engine.reset();
    for (let pulse = 0; pulse < 9; pulse++) f.runtime.tick(pulse, pulse);
    expect(f.midi().at(-1)).toBe(55);
  } finally { f.destroy(); }
});

it("samples Fill/Rotate modulation on clocks and displays only audible scale frames", () => {
  const f = fixture();
  try {
    Object.assign(f.patch.blocks[3], { kind: "voice", voice: "kick", steps: 1, pulses: 0, shape: "sqr", clk: ["G"] });
    f.patch.blocks[1].modulations = [
      { source: "3", destination: "pulses", amount: 0.125 },
      { source: "3", destination: "rot", amount: 1 / 12 },
    ];
    f.runtime.tick(0, 0);
    expect(f.engine.snapshot().blocks[1].effective).toMatchObject({ pulses: 2, rot: -1 });
    f.runtime.tick(0.1, 1);
    expect(f.engine.snapshot().blocks[1].effective).toMatchObject({ pulses: 2, rot: -1 });
    f.context.currentTime = 0.1;
    const snapshot = f.engine.snapshot();
    expect(snapshot.blocks[1].effective).toMatchObject({ pulses: 4, rot: 1 });
    expect(snapshot.blocks[1].lfo).toBeCloseTo(2 / 12);
    expect(f.midi().at(-1)).toBe(50);
  } finally { f.destroy(); }
});

it("advances scale series with Divide, resets to the first scale and passes empty scales through", () => {
  const f = fixture();
  try {
    Object.assign(f.patch.blocks[1], { steps: 2, pulses: 1, div: 2, series: [{ id: "empty", steps: 12, pulses: 0, rot: 0, repeats: 1 }] });
    for (let pulse = 0; pulse < 6; pulse++) f.runtime.tick(0, pulse);
    expect(f.engine.snapshot().blocks[1]).toMatchObject({ rhythmIndex: 1, effective: { pulses: 0 } });
    expect(f.midi().at(-1)).toBe(53);
    f.engine.reset();
    expect(f.engine.snapshot().blocks[1]).toMatchObject({ rhythmIndex: 0, position: -1 });
    f.runtime.tick(0, 0);
    expect(f.midi().at(-1)).toBe(48);
  } finally { f.destroy(); }
});
