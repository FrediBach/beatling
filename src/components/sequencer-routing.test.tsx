import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createEmptyPatch } from "@/lib/patch";
import { cablePort } from "@/lib/cables";
import { connectionsFor } from "@/lib/routing";
import { SequencerRouting } from "./sequencer-routing";

afterEach(cleanup);

it("renders no connection sockets for an unpatched block", () => {
  const { blocks } = createEmptyPatch();
  const { container } = render(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={vi.fn()} />);
  expect(container.querySelector("[data-cable-port]")).toBeNull();
  expect(screen.getByRole("button", { name: "Patch block 01" })).toHaveTextContent("Global clock");
});

it("labels each modulation target and opens the receiving block's settings", () => {
  const { blocks } = createEmptyPatch();
  blocks[0].modulations = [
    { source: "5", destination: "rot", amount: -0.65 },
    { source: "5", destination: "pulses", amount: 0.5 },
  ];
  const onOpen = vi.fn();
  const { container, rerender } = render(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={onOpen} />);
  const rotate = screen.getByRole("button", { name: "Block 06 LFO → block 01 rotate. Open patch settings." });
  expect(within(rotate).getByText("rotate")).toBeInTheDocument();
  expect(within(rotate).getByText("06")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /block 01 fill/ })).toBeInTheDocument();
  const ports = connectionsFor(blocks).map((route) => cablePort(route, "target"));
  expect(new Set(ports).size).toBe(2);
  for (const port of ports) expect(container.querySelector(`[data-cable-port="${port}"]`)).not.toBeNull();
  rotate.focus();
  expect(rotate).toHaveFocus();
  fireEvent.click(rotate);
  expect(onOpen).toHaveBeenCalledWith(0);
  blocks[0].modulations = [];
  rerender(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={true} changedFields={new Set()} onPatchOpen={onOpen} />);
  expect(container.querySelector("[data-cable-port]")).toBeNull();
});

it("groups used outputs and exposes all destinations without unused sockets", () => {
  const { blocks } = createEmptyPatch();
  blocks[0].modulations = [{ source: "5", destination: "rot", amount: 0.5 }, { source: "5", destination: "pulses", amount: 0.5 }];
  blocks[1].modulations = [{ source: "5", destination: "prob", amount: 0.5 }];
  blocks[2].clk = ["5"];
  blocks[3].mut = "5";
  const onOpen = vi.fn();
  const { container } = render(<SequencerRouting index={5} block={blocks[5]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={onOpen} />);
  const lfo = screen.getByRole("button", { name: /Block 06 LFO/ });
  expect(lfo).toHaveTextContent("LFO01 · 02");
  expect(lfo).toHaveAccessibleName(/block 01 rotate; Block 06 LFO → block 01 fill; Block 06 LFO → block 02 chance/);
  expect(container.querySelectorAll("[data-cable-port]")).toHaveLength(3);
  expect(screen.getByRole("button", { name: /Block 06 Trigger → block 03 Clock/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Block 06 Gate → block 04 Mute/ })).toBeInTheDocument();
  fireEvent.click(lfo);
  expect(onOpen).toHaveBeenCalledWith(5);
});

it("combines clock sources while keeping reset and modulation inputs distinct", () => {
  const { blocks } = createEmptyPatch();
  blocks[0].clk = ["1", "2"];
  blocks[0].rst = "3";
  const { container } = render(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={vi.fn()} />);
  expect(screen.getByRole("button", { name: /Block 02 Trigger → block 01 Clock; Block 03 Trigger → block 01 Clock/ })).toHaveTextContent("02 · 03");
  expect(screen.getByRole("button", { name: /Block 04 Trigger → block 01 Reset/ })).toHaveTextContent("Reset");
  expect(container.querySelectorAll("[data-cable-port]")).toHaveLength(2);
});
