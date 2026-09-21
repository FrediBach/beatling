import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  expect(screen.getByText("Global clock")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Patch block 01" })).toBeInTheDocument();
});

it("labels each modulation target and opens the receiving block's settings", () => {
  const { blocks } = createEmptyPatch();
  blocks[0].modulations = [
    { source: "5", destination: "rot", amount: -0.65 },
    { source: "5", destination: "pulses", amount: 0.5 },
  ];
  const onOpen = vi.fn();
  const { container, rerender } = render(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={onOpen} />);
  const input = screen.getByRole("button", { name: /^Inputs to block 01: 2 connections/ });
  expect(input).toHaveTextContent("2");
  expect(input.title).toContain("Block 06 LFO → block 01 rotate");
  expect(input.title).toContain("Block 06 LFO → block 01 fill");
  expect(screen.queryByText("rotate")).not.toBeInTheDocument();
  expect(input.closest(".routing-strip")).not.toBeNull();
  const ports = connectionsFor(blocks).map((route) => cablePort(route, "target"));
  expect(new Set(ports).size).toBe(2);
  for (const port of ports) expect(container.querySelector(`[data-cable-port="${port}"]`)).not.toBeNull();
  input.focus();
  expect(input).toHaveFocus();
  fireEvent.click(input);
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
  const output = screen.getByRole("button", { name: /^Outputs from block 06: 5 connections/ });
  expect(output).toHaveTextContent("5");
  expect(output.title).toContain("Block 06 LFO → block 01 rotate");
  expect(output.title).toContain("Block 06 LFO → block 01 fill");
  expect(output.title).toContain("Block 06 LFO → block 02 chance");
  expect(container.querySelectorAll("[data-cable-port]")).toHaveLength(3);
  expect(screen.getByRole("button", { name: /Block 06 Trigger → block 03 Clock/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Block 06 Gate → block 04 Mute/ })).toBeInTheDocument();
  fireEvent.click(output);
  expect(onOpen).toHaveBeenCalledWith(5);
});

it("combines clock sources while keeping reset and modulation inputs distinct", () => {
  const { blocks } = createEmptyPatch();
  blocks[0].clk = ["1", "2"];
  blocks[0].rst = "3";
  const { container } = render(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={vi.fn()} />);
  const input = screen.getByRole("button", { name: /^Inputs to block 01: 3 connections/ });
  expect(input.title).toContain("Block 02 Trigger → block 01 Clock");
  expect(input.title).toContain("Block 03 Trigger → block 01 Clock");
  expect(input.title).toContain("Block 04 Trigger → block 01 Reset");
  expect(container.querySelectorAll("[data-cable-port]")).toHaveLength(2);
});

it("keeps both banks in the existing footer when every input is assigned", () => {
  const { blocks } = createEmptyPatch();
  blocks[0].clk = Array.from({ length: 15 }, (_, i) => String(i + 1)) as typeof blocks[0]["clk"];
  blocks[0].rst = "1";
  blocks[0].mut = "2";
  const destinations = ["pulses", "rot", "prob", "div", "tune", "decay", "level"] as const;
  blocks[0].modulations = destinations.map((destination) => ({ source: "5", destination, amount: 0.5 }));
  blocks[1].modulations = [{ source: "0", destination: "rot", amount: 0.5 }];
  blocks[1].clk = ["0"];
  blocks[1].mut = "0";
  const { container } = render(<SequencerRouting index={0} block={blocks[0]} blocks={blocks} patchOpen={false} changedFields={new Set()} onPatchOpen={vi.fn()} />);
  expect(screen.getByRole("button", { name: /^Inputs to block 01: 24 connections/ })).toHaveTextContent("24");
  expect(screen.getByRole("button", { name: /^Outputs from block 01: 3 connections/ })).toHaveTextContent("3");
  expect(container.children).toHaveLength(1);
  expect(container.firstElementChild).toHaveClass("routing-strip");
  expect(container.querySelectorAll("[data-cable-port]")).toHaveLength(13);
  expect(container.querySelector("button button")).toBeNull();
});
