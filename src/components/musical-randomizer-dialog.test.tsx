import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PatternToolbar } from "./pattern-toolbar";
import { SequencerEngine } from "@/audio/engine";
import { createDemoPatch, createRandomizationLocks } from "@/lib/patch";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup() {
  const patch = createDemoPatch();
  const engine = new SequencerEngine(patch);
  const props = { patch, variationId: "a", locks: createRandomizationLocks(), engine, onPause: vi.fn(), onApply: vi.fn(() => true), allLocked: false, onShuffle: vi.fn(), onClear: vi.fn(), onToggleLocks: vi.fn() };
  const view = render(<PatternToolbar {...props} />);
  const trigger = screen.getByRole("button", { name: "Musical randomizer" });
  trigger.focus(); fireEvent.click(trigger);
  return { props, view, trigger };
}

function generate() {
  fireEvent.click(screen.getByRole("button", { name: "Next: character" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate groove" }));
}

it("generates and revisits draft ideas without committing, then restores focus on cancel", async () => {
  const { props, trigger } = setup();
  const start = vi.spyOn(props.engine, "start").mockResolvedValue();
  fireEvent.click(screen.getByRole("button", { name: "Broken beat" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Lead" }));
  generate();
  const first = screen.getByText(/Seed \d/).textContent;
  fireEvent.click(screen.getByRole("button", { name: "Try another" }));
  expect(screen.getByText(/Seed \d/).textContent).not.toBe(first);
  fireEvent.click(screen.getByRole("button", { name: "Idea 1" }));
  expect(screen.getByText(/Seed \d/).textContent).toBe(first);
  expect(props.onApply).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(props.engine.auditioning).toBe(false);
});

it("applies the selected candidate once with the original source and variation identity", () => {
  const { props } = setup();
  generate();
  fireEvent.click(screen.getByRole("button", { name: "Apply groove" }));
  expect(props.onApply).toHaveBeenCalledOnce();
  const [result, source, variationId] = props.onApply.mock.calls[0] as unknown as [typeof props.patch, typeof props.patch, string];
  expect(result.blocks).toHaveLength(16);
  expect(result.blocks.some((block) => block.voice === "bassline")).toBe(true);
  expect(result.blocks.some((block) => block.voice === "lead")).toBe(true);
  expect(source).toBe(props.patch);
  expect(variationId).toBe("a");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("requires refresh when the committed source changes and defaults reshape to current settings", () => {
  const { props, view } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Reshape this patch" }));
  fireEvent.click(screen.getByRole("button", { name: "Next: character" }));
  expect(screen.getByLabelText("Tempo")).toHaveValue(props.patch.bpm);
  expect(screen.getByRole("button", { name: "Keep current" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Tonal settings")).toHaveValue("keep");
  view.rerender(<PatternToolbar {...props} patch={{ ...props.patch, bpm: 87 }} variationId="b" />);
  expect(screen.getByRole("alert")).toHaveTextContent(/current variation or patch changed/);
  expect(screen.getByRole("button", { name: "Generate groove" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh source" }));
  fireEvent.click(screen.getByRole("button", { name: "Next: character" }));
  expect(screen.getByLabelText("Tempo")).toHaveValue(87);
});

it("keeps constraints visible and does not commit when all selected parts are kept", () => {
  const { props } = setup();
  for (const name of ["Kick", "Snare", "Closed hat", "Open hat", "Rim", "Shaker", "Bassline", "Lead"]) fireEvent.click(screen.getByRole("checkbox", { name: `Keep ${name}` }));
  generate();
  expect(screen.getByRole("alert")).toHaveTextContent(/protected/);
  expect(props.onApply).not.toHaveBeenCalled();
});

it("ends an in-flight audition on close without committing or leaking document shortcuts", async () => {
  const { props } = setup();
  let finish!: () => void;
  vi.spyOn(props.engine, "start").mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const keydown = vi.fn();
  document.addEventListener("keydown", keydown);
  generate();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "z", ctrlKey: true });
  expect(keydown).not.toHaveBeenCalled();
  document.removeEventListener("keydown", keydown);
  fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
  expect(props.engine.auditioning).toBe(true);
  expect(props.onPause).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(props.engine.auditioning).toBe(false);
  await act(async () => finish());
  expect(props.onApply).not.toHaveBeenCalled();
  expect(props.engine.running).toBe(false);
});
