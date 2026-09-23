import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { VOICE_DEFS } from "@/lib/constants";
import { createEmptyPatch } from "@/lib/patch";
import { VOICE_PRESETS } from "@/lib/voice-presets";
import type { Machine, VoiceId } from "@/lib/types";
import { VoiceEditorDialog } from "./voice-editor-dialog";

afterEach(cleanup);

function Fixture({ id, machine = "custom" }: { id: VoiceId; machine?: Machine }) {
  const [voice, setVoice] = useState(() => ({ ...createEmptyPatch().voices[id], machine, tune: -5, decay: 81 }));
  return <VoiceEditorDialog open onOpenChange={() => {}} voiceId={id} voiceName={VOICE_DEFS.find((voice) => voice.id === id)!.name} value={voice} effective={{ tune: 0, decay: 0, level: 0, vOct: 0 }} onChange={setVoice} onCloseAutoFocus={() => {}} />;
}

it.each(VOICE_DEFS)("selects every $name sound and resets synthesis without changing tune or decay", ({ id, name }) => {
  render(<Fixture id={id} />);
  const select = screen.getByRole("combobox", { name: `${name} Sound preset` });
  expect(select).toHaveValue("default");
  for (const preset of VOICE_PRESETS[id]) {
    fireEvent.change(select, { target: { value: preset.id } });
    expect(select).toHaveValue(preset.id);
    expect(select).toHaveAccessibleDescription(expect.stringContaining(preset.description));
  }
  expect(screen.getByRole("slider", { name: `${name} tune` })).toHaveValue("-5");
  expect(screen.getByRole("slider", { name: `${name} decay` })).toHaveValue("81");
  fireEvent.click(screen.getByRole("button", { name: "Reset synthesis" }));
  expect(select).toHaveValue("default");
});

it("shows Custom settings after a sound edit and recognizes restored preset values", () => {
  render(<Fixture id="kick" />);
  const select = screen.getByRole("combobox", { name: "Kick Sound preset" });
  fireEvent.change(select, { target: { value: "sub" } });
  const frequency = screen.getByRole("slider", { name: "Kick Body frequency" });
  expect(frequency).toHaveValue("38");
  fireEvent.change(frequency, { target: { value: "42" } });
  expect(select).toHaveValue("");
  fireEvent.change(frequency, { target: { value: "38" } });
  expect(select).toHaveValue("sub");
});

it.each(["808", "909"] as const)("keeps synthesis presets out of the %s drum editor", (machine) => {
  render(<Fixture id="oh" machine={machine} />);
  expect(screen.queryByRole("combobox", { name: "Open hat Sound preset" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open hat Choke by: Closed hat" })).toBeInTheDocument();
});
