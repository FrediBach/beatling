import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ModulationScope } from "./modulation-scope";
import { PatchPanel } from "./patch-panel";
import { SequencerParameters } from "./sequencer-parameters";
import { createEmptyPatch, createRandomizationLocks } from "@/lib/patch";
import { effectiveBlock } from "@/lib/euclid";

afterEach(cleanup);

function Fixture() {
  const [patch, setPatch] = useState(createEmptyPatch);
  return <PatchPanel index={0} blocks={patch.blocks} voice={patch.voices.kick} onChange={(block) => setPatch({ ...patch, blocks: patch.blocks.map((item, index) => index === 0 ? block : item) })} onSelect={() => undefined} onClose={() => undefined} />;
}

it("adds independent targets, edits depths, preserves keyboard focus, and removes one route", () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Add modulation target" }));
  fireEvent.change(screen.getByLabelText("Modulation source for fill"), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("Modulation amount for fill"), { target: { value: "-65" } });
  fireEvent.click(screen.getByRole("button", { name: "Add modulation target" }));
  expect(screen.getByLabelText("Modulation source for rotate")).toHaveValue("12");
  fireEvent.change(screen.getByLabelText("Modulation source for rotate"), { target: { value: "13" } });
  fireEvent.change(screen.getByLabelText("Modulation destination for rotate"), { target: { value: "prob" } });
  expect(screen.getByLabelText("Modulation destination for chance")).toHaveFocus();
  expect(screen.getByLabelText("Modulation source for chance")).toHaveValue("13");
  expect(screen.getByLabelText("Modulation amount for fill")).toHaveValue("-65");
  expect(screen.getByRole("button", { name: "Block 13 LFO to block 01 fill" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Block 14 LFO to block 01 chance" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove fill modulation" }));
  expect(screen.queryByLabelText("Modulation amount for fill")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Modulation amount for chance")).toHaveValue("50");
  expect(screen.getByRole("button", { name: "Add modulation target" })).toHaveFocus();
  expect(screen.getByText("How to set up modulation")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("LFO waveform"), { target: { value: "tri" } });
  expect(screen.getByRole("img", { name: "triangle modulation waveform" })).toBeInTheDocument();
});

it("limits targets to seven and restores focus when removing from a full setup", () => {
  render(<Fixture />);
  const add = screen.getByRole("button", { name: "Add modulation target" });
  for (let index = 0; index < 7; index++) fireEvent.click(add);
  expect(add).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Remove fill modulation" }));
  expect(add).toBeEnabled();
  expect(add).toHaveFocus();
  expect(screen.getAllByRole("slider", { name: /Modulation amount/ })).toHaveLength(6);
});

it("shows depth and live results beside the editable base values", () => {
  const block = createEmptyPatch().blocks[0];
  block.pulses = 4;
  block.modulations = [{ source: "12", destination: "pulses", amount: 0.5 }];
  render(<SequencerParameters index={0} block={block} visual={{ position: 0, lfo: 0, fire: false, muted: false, effective: effectiveBlock(block, () => 1) }} locks={createRandomizationLocks()[0]} changedFields={new Set()} onChange={() => undefined} onParameterRandomize={() => undefined} onParameterLockToggle={() => undefined} />);
  const control = screen.getByRole("button", { name: "Fill: 4" });
  expect(within(control).getByText("+50%")).toBeInTheDocument();
  expect(within(control).getByText("→8")).toBeInTheDocument();
  expect(control).toHaveAccessibleDescription("Modulation from block 13, depth +50%, current value 8");
});

it("previews the Euclidean cycle count and rotation and explains an empty modulator", () => {
  const block = { ...createEmptyPatch().blocks[12], steps: 8, pulses: 3, shape: "tri" as const };
  const { rerender } = render(<ModulationScope block={block} />);
  expect(screen.getByRole("img", { name: "triangle modulation waveform, 3 cycles in 8 steps, rotation 0" })).toBeInTheDocument();
  expect(screen.getByText("Each filled step starts a wave that lasts until the next filled step.")).toBeInTheDocument();
  rerender(<ModulationScope block={{ ...block, pulses: 5, rot: 2 }} />);
  expect(screen.getByRole("img", { name: "triangle modulation waveform, 5 cycles in 8 steps, rotation 2" })).toBeInTheDocument();
  rerender(<ModulationScope block={{ ...block, pulses: 0 }} />);
  expect(screen.getByText("Fill 0 · no modulation")).toBeInTheDocument();
  expect(screen.getByText("Raise Fill to create waveform cycles.")).toBeInTheDocument();
});
