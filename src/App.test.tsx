import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("application shell", () => {
  it("renders all sequencer blocks and keeps primary controls interactive", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    expect(screen.getAllByTestId(/^block-/)).toHaveLength(16);
    expect(screen.getByLabelText("Beats per minute")).toHaveValue("124");
    fireEvent.click(screen.getByRole("button", { name: /mute block 01/i }));
    expect(screen.getByRole("button", { name: /unmute block 01/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Patch block 01" }));
    expect(screen.getByText("Clock in — sources add up")).toBeInTheDocument();
  });

  it("loads a factory preset from the transport dropdown", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.change(screen.getByLabelText("Drum pattern preset"), { target: { value: "boom-bap" } });
    expect(screen.getByLabelText("Drum pattern preset")).toHaveValue("boom-bap");
    expect(screen.getByLabelText("Beats per minute")).toHaveValue("90");
  });

  it("locks individual, block and global randomization controls", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Lock Steps in block 01" }));
    expect(screen.getByRole("button", { name: "Unlock Steps in block 01" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Randomize Steps in block 01" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lock all settings in block 01" }));
    expect(screen.getByRole("button", { name: "Randomize block 01" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lock all" }));
    expect(screen.getByRole("button", { name: "Unlock all" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeDisabled();
  });
});

describe("patch bay", () => {
  it("highlights connected blocks, edits routing and follows a connection", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Patch block 03" }));
    expect(screen.getByTestId("block-13")).toHaveClass("is-related");
    expect(screen.getByLabelText("Modulation source")).toHaveValue("12");
    fireEvent.change(screen.getByLabelText("Modulation source"), { target: { value: "13" } });
    expect(screen.getByTestId("block-14")).toHaveClass("is-related");
    expect(screen.getByTestId("block-13")).not.toHaveClass("is-related");
    fireEvent.click(screen.getByRole("button", { name: "Block 14 LFO to block 03 chance" }));
    expect(screen.getByRole("region", { name: "Routing for block 14" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /Routing for block/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Patch block 14" })).toHaveFocus();
  });
});
