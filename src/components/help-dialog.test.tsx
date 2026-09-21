import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpDialog } from "@/components/help-dialog";

afterEach(cleanup);

function openHelp() {
  render(<HelpDialog />);
  const trigger = screen.getByRole("button", { name: "Open Beatling help" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

function selectChapter(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}

describe("Beatling help", () => {
  it("opens a named dialog, explains Euclidean rhythm interactively, and restores focus on Escape", async () => {
    const trigger = openHelp();
    const dialog = screen.getByRole("dialog", { name: "Find your rhythm." });
    expect(within(dialog).getByRole("tab", { name: /Start here/ })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("img", { name: /5 hits over 16 steps/ })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("slider", { name: /Fill/ }), { target: { value: "4" } });
    fireEvent.change(within(dialog).getByRole("slider", { name: /Rotate/ }), { target: { value: "2" } });
    expect(within(dialog).getByRole("img", { name: "4 hits over 16 steps, rotation 2. Hit positions: 3, 7, 11, 15." })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("makes advanced features and an exact beat recipe discoverable by chapter", () => {
    openHelp();
    selectChapter("Build a beat");
    expect(screen.getByRole("heading", { name: "From a pulse to a pocket." })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Clap hits on steps 5, 13" })).toBeInTheDocument();
    expect(screen.getByText(/All lanes: Steps 16/)).toBeInTheDocument();
    selectChapter("Patch & modulate");
    expect(screen.getByRole("heading", { name: "Bernoulli: one hit, two choices" })).toBeInTheDocument();
    selectChapter("Sound & FX");
    expect(screen.getByRole("heading", { name: "Melodies from modulation" })).toBeInTheDocument();
    selectChapter("Rhythm");
    expect(screen.getByRole("heading", { name: "Rhythm series" })).toBeInTheDocument();
    selectChapter("Arrange");
    expect(screen.getByRole("heading", { name: "Build a song" })).toBeInTheDocument();
    selectChapter("Save & keys");
    expect(screen.getByText(/This export does not include the other variations/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Keep your hands on the instrument" })).toBeInTheDocument();
  });

  it("keeps reading and example keys from invoking background document shortcuts", async () => {
    const trigger = openHelp();
    const shortcut = vi.fn();
    document.addEventListener("keydown", shortcut);
    try {
      fireEvent.keyDown(screen.getByRole("tabpanel"), { key: " ", code: "Space" });
      fireEvent.keyDown(screen.getByRole("tab", { name: /Start here/ }), { key: "z", ctrlKey: true });
      expect(shortcut).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Back to the beat" }));
      await waitFor(() => expect(trigger).toHaveFocus());
    } finally {
      document.removeEventListener("keydown", shortcut);
    }
  });
});
