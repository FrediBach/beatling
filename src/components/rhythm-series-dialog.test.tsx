import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import { createEmptyPatch } from "@/lib/patch";
import type { SequencerBlock } from "@/lib/types";
import { RhythmSeriesDialog } from "./rhythm-series-dialog";

function Harness() {
  const [block, setBlock] = useState<SequencerBlock>(() => createEmptyPatch().blocks[0]);
  return <RhythmSeriesDialog open onOpenChange={() => undefined} block={block} blockNumber="01" activeRhythm={1} onChange={setBlock} />;
}

it("adds, edits, reorders and removes rhythms without exposing block routing", () => {
  render(<Harness />);
  expect(screen.getByText(/Routing, clock, probability, voice and modulation stay shared/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add rhythm" }));
  expect(screen.getAllByLabelText("Plays")).toHaveLength(2);
  expect(screen.getByText("Playing")).toBeInTheDocument();

  fireEvent.change(screen.getAllByLabelText("Steps")[1], { target: { value: "12" } });
  fireEvent.change(screen.getAllByLabelText("Fill")[1], { target: { value: "5" } });
  fireEvent.change(screen.getAllByLabelText("Plays")[0], { target: { value: "3" } });
  expect(screen.getAllByLabelText("Steps")[1]).toHaveValue(12);
  expect(screen.getAllByLabelText("Fill")[1]).toHaveValue(5);
  expect(screen.getAllByLabelText("Plays")[0]).toHaveValue(3);

  fireEvent.click(screen.getByRole("button", { name: "Move rhythm 2 earlier" }));
  expect(screen.getAllByLabelText("Steps")[0]).toHaveValue(12);
  fireEvent.click(screen.getByRole("button", { name: "Delete rhythm 1" }));
  expect(screen.getAllByLabelText("Steps")).toHaveLength(1);
});
