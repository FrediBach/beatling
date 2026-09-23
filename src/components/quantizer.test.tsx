import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createEmptyPatch, createRandomizationLocks } from "@/lib/patch";
import { effectiveBlock } from "@/lib/euclid";
import { SequencerCard } from "./sequencer-card";
import { PatchPanel } from "./patch-panel";

afterEach(cleanup);

function Fixture() {
  const [blocks, setBlocks] = useState(() => createEmptyPatch().blocks);
  const block = blocks[0];
  const change = (next: typeof block) => setBlocks(blocks.map((item, index) => index === 0 ? next : item));
  return <>
    <SequencerCard index={0} block={block} blocks={blocks} visual={{ position: -1, lfo: 0, fire: false, muted: false, effective: effectiveBlock(block) }} patchOpen related={false} locks={createRandomizationLocks()[0]} onPatchOpen={() => undefined} onChange={change} onRandomize={() => undefined} onLockToggle={() => undefined} onParameterRandomize={() => undefined} onParameterLockToggle={() => undefined} />
    <PatchPanel index={0} blocks={blocks} onChange={change} onSelect={() => undefined} onClose={() => undefined} />
  </>;
}

it("creates a quantizer card, routes pitch input and retains rhythm modulation controls", () => {
  render(<Fixture />);
  fireEvent.change(screen.getByLabelText("Block type or voice for block 01"), { target: { value: "quantizer" } });
  expect(screen.getByRole("button", { name: "Steps: 12" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Fill: 7" })).toBeInTheDocument();
  expect(screen.getByLabelText("Euclidean scale")).toHaveTextContent("C · D · E · F♯ · G · A · B");
  expect(screen.queryByLabelText("LFO waveform")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Pitch CV input"), { target: { value: "12" } });
  expect(screen.getByRole("button", { name: "Block 13 LFO to block 01 Pitch CV" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add modulation target" }));
  fireEvent.change(screen.getByLabelText("Modulation source for fill"), { target: { value: "13" } });
  expect(screen.getByRole("button", { name: "Block 14 LFO to block 01 fill" })).toBeInTheDocument();
});
