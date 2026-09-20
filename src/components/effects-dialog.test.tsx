import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EffectsDialog } from "@/components/effects-dialog";
import { EffectControl } from "@/components/effect-control";
import { createEffects } from "@/lib/effects";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Harness() {
  const [value, onChange] = useState(createEffects);
  return <EffectsDialog open onOpenChange={() => undefined} value={value} onChange={onChange} />;
}

function chooseEffect(name: string) {
  const tab = screen.getByRole("tab", { name: new RegExp(name) });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

function enterValue(name: string, value: string) {
  const input = screen.getByRole("textbox", { name });
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("effects rack", () => {
  it("keeps sends independent across processors and preserves them while bypassed", () => {
    render(<Harness />);
    expect(screen.getAllByRole("slider", { name: / send$/ })).toHaveLength(12);
    expect(screen.getByRole("status")).toHaveTextContent("Effect bypassed");
    fireEvent.change(screen.getByRole("slider", { name: "Kick Distortion send" }), { target: { value: "64" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable distortion" }));
    expect(screen.getByRole("status")).toHaveTextContent("Sends follow voice level");
    fireEvent.click(screen.getByRole("button", { name: "Disable distortion" }));
    expect(screen.getByRole("slider", { name: "Kick Distortion send" })).toHaveValue("64");
    chooseEffect("Reverb");
    expect(screen.getByRole("slider", { name: "Kick Reverb send" })).toHaveValue("0");
    enterValue("Snare Reverb send value", "28");
    chooseEffect("Distortion");
    expect(screen.getByRole("slider", { name: "Kick Distortion send" })).toHaveValue("64");
    chooseEffect("Reverb");
    expect(screen.getByRole("slider", { name: "Snare Reverb send" })).toHaveValue("28");
  });

  it("supports exact values, bounds, steps, invalid input, and Escape cancellation", () => {
    render(<Harness />);
    enterValue("Distortion Drive value", "81");
    expect(screen.getByRole("slider", { name: "Distortion Drive" })).toHaveValue("81");
    enterValue("Distortion Tone value", "8456");
    expect(screen.getByRole("slider", { name: "Distortion Tone" })).toHaveValue("8500");
    enterValue("Distortion Drive value", "999");
    expect(screen.getByRole("slider", { name: "Distortion Drive" })).toHaveValue("100");
    enterValue("Distortion Drive value", "invalid");
    expect(screen.getByRole("textbox", { name: "Distortion Drive value" })).toHaveValue("100");
    enterValue("Distortion Drive value", "");
    expect(screen.getByRole("slider", { name: "Distortion Drive" })).toHaveValue("100");
    const input = screen.getByRole("textbox", { name: "Distortion Drive value" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("100");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Distortion Drive" }));
    expect(screen.getByRole("slider", { name: "Distortion Drive" })).toHaveValue("35");
  });

  it("resets only selected parameters or sends and can reset the whole rack", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Enable distortion" }));
    enterValue("Distortion Drive value", "80");
    enterValue("Kick Distortion send value", "50");
    chooseEffect("Delay");
    enterValue("Kick Delay send value", "30");
    chooseEffect("Distortion");
    fireEvent.click(screen.getByRole("button", { name: "Reset distortion parameters" }));
    expect(screen.getByRole("slider", { name: "Distortion Drive" })).toHaveValue("35");
    expect(screen.getByRole("button", { name: "Disable distortion" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("slider", { name: "Kick Distortion send" })).toHaveValue("50");
    fireEvent.click(screen.getByRole("button", { name: "Clear distortion sends" }));
    expect(screen.getByRole("slider", { name: "Kick Distortion send" })).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Clear distortion sends" })).toBeDisabled();
    chooseEffect("Delay");
    expect(screen.getByRole("slider", { name: "Kick Delay send" })).toHaveValue("30");
    fireEvent.click(screen.getByRole("button", { name: "Reset effects" }));
    expect(screen.getByRole("slider", { name: "Kick Delay send" })).toHaveValue("0");
    expect(screen.getByRole("tab", { name: /Distortion/ })).toHaveTextContent("Bypassed");
  });

  it("commits a pending numeric edit before switching processors", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Distortion Drive value" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "72" } });
    chooseEffect("Reverb");
    chooseEffect("Distortion");
    expect(screen.getByRole("slider", { name: "Distortion Drive" })).toHaveValue("72");
  });

  it("explains enabled but inaudible effects and names each control uniquely", () => {
    render(<Harness />);
    chooseEffect("Compressor");
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByRole("slider", { name: "Compressor Threshold" })).toHaveValue("-24");
    fireEvent.click(panel.getByRole("button", { name: "Enable compressor" }));
    expect(screen.getByRole("status")).toHaveTextContent("Raise a voice send");
    enterValue("Compressor Return value", "0");
    expect(screen.getByRole("status")).toHaveTextContent("Return is at zero");
    enterValue("Compressor Ratio value", "4.5");
    expect(panel.getByRole("slider", { name: "Compressor Ratio" })).toHaveAttribute("aria-valuetext", "4.5:1");
  });
});

describe("effect dial", () => {
  it("supports vertical dragging, fine adjustment, and pointer cancellation", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const capture = vi.fn();
    const onChange = vi.fn();
    render(<EffectControl label="Drive" value={35} defaultValue={35} knob onChange={onChange} />);
    const dial = screen.getByRole("slider", { name: "Drive" });
    Object.defineProperty(dial, "setPointerCapture", { value: capture });
    fireEvent.pointerDown(dial, { button: 0, clientY: 100 });
    fireEvent.pointerMove(dial, { clientY: 84 });
    expect(onChange).toHaveBeenLastCalledWith(45);
    fireEvent.pointerMove(dial, { clientY: 68, shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(46);
    fireEvent.pointerCancel(dial);
    onChange.mockClear();
    fireEvent.pointerMove(dial, { clientY: 0 });
    expect(onChange).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalled();
    expect(dial).toHaveFocus();
  });
});
