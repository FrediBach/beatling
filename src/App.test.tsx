import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";

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
});
