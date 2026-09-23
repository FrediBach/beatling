import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "@/App";
import { SequencerEngine } from "@/audio/engine";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("commits a generated groove as one undo step in B while preserving variation A", async () => {
  vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
  const save = vi.spyOn(window.localStorage.__proto__, "setItem");
  render(<App />);
  fireEvent.change(screen.getByLabelText("Beats per minute"), { target: { value: "151" } });
  fireEvent.click(screen.getByRole("button", { name: "Add variation" }));
  expect(screen.getByRole("button", { name: "Undo last change" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Musical randomizer" }));
  fireEvent.click(screen.getByRole("button", { name: "Next: character" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate groove" }));
  fireEvent.click(screen.getByRole("button", { name: "Try another" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply groove" }));
  expect(screen.getByLabelText("Beats per minute")).toHaveValue("122");
  await waitFor(() => {
    const saved = save.mock.calls.filter(([key]) => String(key).includes("arrangement")).at(-1);
    expect(saved).toBeDefined();
    const arrangement = JSON.parse(String(saved![1]));
    expect(arrangement.variations.map((variation: { patch: { bpm: number } }) => variation.patch.bpm)).toEqual([151, 122]);
  });
  fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
  expect(screen.getByLabelText("Beats per minute")).toHaveValue("151");
  expect(screen.getByRole("button", { name: "Undo last change" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Redo last change" }));
  expect(screen.getByLabelText("Beats per minute")).toHaveValue("122");
  fireEvent.click(screen.getByRole("tab", { name: "Variation A" }));
  expect(screen.getByLabelText("Beats per minute")).toHaveValue("151");
});

it("does not persist preview drafts and restores the committed patch on cancel", async () => {
  vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
  const save = vi.spyOn(window.localStorage.__proto__, "setItem");
  vi.spyOn(SequencerEngine.prototype, "start").mockResolvedValue();
  const begin = vi.spyOn(SequencerEngine.prototype, "beginAudition");
  render(<App />);
  await waitFor(() => expect(save.mock.calls.some(([key]) => key === "egs.patch.v29")).toBe(true));
  save.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Musical randomizer" }));
  fireEvent.click(screen.getByRole("button", { name: "Next: character" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate groove" }));
  fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
  await waitFor(() => expect(begin).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("Beats per minute")).toHaveValue("124");
  expect(screen.getByRole("button", { name: "Undo last change" })).toBeDisabled();
  expect(save.mock.calls.some(([key]) => String(key).startsWith("egs."))).toBe(false);
});
