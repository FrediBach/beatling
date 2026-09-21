import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportDialog } from "@/components/export-dialog";
import { createDemoPatch } from "@/lib/patch";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExportDialog", () => {
  it("offers Lua data, MIDI download, Strudel code, and editable JSON", () => {
    const createObjectURL = vi.fn(() => "blob:beatling");
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<ExportDialog open onOpenChange={vi.fn()} patch={createDemoPatch()} onLoad={vi.fn()} />);
    expect(screen.getByLabelText<HTMLTextAreaElement>("Export text").value).toContain("return {");
    expect(screen.getByLabelText("Export text")).toHaveAttribute("readonly");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "MIDI" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: "Download .mid" }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "audio/midi" }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:beatling");
    expect(screen.getByText("Downloaded MIDI file.")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Strudel" }), { button: 0, ctrlKey: false });
    expect(screen.getByLabelText<HTMLTextAreaElement>("Export text").value).toContain("setcpm(31)");
    expect(screen.getByLabelText("Export text")).toHaveAttribute("readonly");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "JSON" }), { button: 0, ctrlKey: false });
    expect(screen.getByLabelText("Export text")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Load JSON" })).toBeInTheDocument();
  });
});
