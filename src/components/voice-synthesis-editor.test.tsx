import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createCustomVoiceSettings, VOICE_PARAMETER_SECTIONS } from "@/lib/voice-config";
import type { VoiceId } from "@/lib/types";
import { VoiceSynthesisEditor } from "./voice-synthesis-editor";

afterEach(cleanup);

it.each(["bassline", "lead"] as const)("can bypass the %s quantizer without losing the saved scale", (id) => {
  render(<Fixture id={id} />);
  const scale = screen.getByLabelText("Test voice Scale");
  fireEvent.change(scale, { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Test voice Quantizer: Off" }));
  expect(screen.getByRole("button", { name: "Test voice Quantizer: Off" })).toHaveAttribute("aria-pressed", "true");
  expect(scale).toHaveValue("3");
  expect(scale).toHaveAccessibleDescription(/Saved while Quantizer is off/);
  fireEvent.click(screen.getByRole("button", { name: "Test voice Quantizer: On" }));
  expect(scale).toHaveValue("3");
  expect(scale).not.toHaveAccessibleDescription(/Saved while Quantizer is off/);
});

function Fixture({ id = "rim", custom = true }: { id?: VoiceId; custom?: boolean }) {
  const [value, setValue] = useState(() => createCustomVoiceSettings(id));
  return <VoiceSynthesisEditor voiceId={id} voiceName="Test voice" value={value} custom={custom} onChange={(key, next) => setValue((current) => ({ ...current, [key]: next }))} />;
}

it.each(Object.keys(VOICE_PARAMETER_SECTIONS) as VoiceId[])("keeps every %s synthesis parameter accessible exactly once", (id) => {
  render(<Fixture id={id} />);
  for (const definition of VOICE_PARAMETER_SECTIONS[id].flatMap((section) => section.parameters)) {
    if (definition.options && definition.options.length <= 3 || definition.key === "burstCount") {
      expect(screen.getByRole("group", { name: definition.label })).toBeInTheDocument();
    } else {
      expect(screen.getByRole(definition.options ? "combobox" : "slider", { name: `Test voice ${definition.label}` })).toHaveAccessibleDescription(expect.stringContaining(definition.description));
    }
  }
});

it("explains linked rim controls and retains prepared values when switching modes", () => {
  render(<Fixture />);
  const length = screen.getByRole("slider", { name: "Test voice Noise length" });
  expect(length).toHaveAccessibleDescription(/Saved for Independent mode/);
  fireEvent.change(length, { target: { value: "85" } });
  fireEvent.click(screen.getByRole("button", { name: "Test voice Noise envelope: Independent" }));
  expect(length).toHaveValue("85");
  expect(length).not.toHaveAccessibleDescription(/Saved for Independent mode/);
  expect(screen.getByRole("slider", { name: "Test voice Noise filter" })).toHaveAccessibleDescription(/Follows Body filter/);
  fireEvent.click(screen.getByRole("button", { name: "Test voice Noise envelope: Linked" }));
  fireEvent.click(screen.getByRole("button", { name: "Test voice Noise envelope: Independent" }));
  expect(length).toHaveValue("85");
});

it("updates the partial illustration and accepts, clamps and cancels precise entries", () => {
  render(<Fixture />);
  const entry = screen.getByRole("textbox", { name: "Test voice Partial balance value" });
  fireEvent.focus(entry);
  fireEvent.change(entry, { target: { value: "75" } });
  expect(screen.getByText(/50% low \/ 50% high/)).toBeInTheDocument();
  fireEvent.blur(entry);
  expect(screen.getByText(/25% low \/ 75% high/)).toBeInTheDocument();
  fireEvent.focus(entry);
  fireEvent.change(entry, { target: { value: "200" } });
  fireEvent.blur(entry);
  expect(screen.getByRole("slider", { name: "Test voice Partial balance" })).toHaveValue("100");
  act(() => entry.focus());
  fireEvent.change(entry, { target: { value: "30" } });
  fireEvent.keyDown(entry, { key: "Escape" });
  expect(entry).toHaveValue("100");
});

it("uses a burst selector to update the clap timing illustration", () => {
  render(<Fixture id="clap" />);
  const bursts = screen.getByRole("group", { name: "Burst count" });
  fireEvent.click(within(bursts).getByRole("button", { name: "Test voice Burst count: 5" }));
  fireEvent.change(screen.getByRole("slider", { name: "Test voice Burst spacing" }), { target: { value: "20" } });
  expect(screen.getByText(/5 bursts · 20 ms apart/)).toBeInTheDocument();
});

it("shows the square waveform and its pulse width when selected", () => {
  render(<Fixture id="bassline" />);
  fireEvent.click(screen.getByRole("button", { name: "Test voice Oscillator: Square" }));
  fireEvent.change(screen.getByRole("slider", { name: "Test voice Pulse width" }), { target: { value: "25" } });
  expect(screen.getByText(/Main waveform sketch · Square · 25% pulse width/)).toBeInTheDocument();
  expect(screen.queryByText("Choose Square to hear pulse width")).not.toBeInTheDocument();
});

it("shows only choking for a modelled open hat", () => {
  render(<Fixture id="oh" custom={false} />);
  expect(screen.getByRole("heading", { name: "Closed-hat interaction" })).toBeInTheDocument();
  expect(screen.queryByRole("slider", { name: "Test voice Metal level" })).not.toBeInTheDocument();
});
