import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { createEmptyPatch } from "@/lib/patch";
import { connectionsFor } from "@/lib/routing";
import type { Patch, VoiceId, VoiceState } from "@/lib/types";
import { VoiceBank } from "./voice-bank";

afterEach(cleanup);

function Fixture() {
  const [patch, setPatch] = useState<Patch>(() => createEmptyPatch());
  const update = (id: VoiceId, voice: VoiceState) => setPatch((current) => ({ ...current, voices: { ...current.voices, [id]: voice } }));
  return <VoiceBank voices={patch.voices} blocks={patch.blocks} connections={connectionsFor(patch)} lfoValues={patch.blocks.map((_block, index) => index === 12 ? 1 : 0.5)} activeVoices={{}} onChange={update} />;
}

it("patches a block LFO into a shared voice and exposes a cable socket", () => {
  const { container } = render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Patch Kick voice" }));
  expect(screen.getByRole("heading", { name: "Kick modulation" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add modulation target" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Modulation source for Kick Tune" }), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  const input = screen.getByRole("button", { name: /^Inputs to voice Kick: 1 connection/ });
  expect(input.title).toContain("Block 13 LFO → voice Kick Tune");
  expect(container.querySelector('[data-voice-id="kick"] [data-cable-port="in-Mod-Tune"]')).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Configure Kick voice" }));
  expect(screen.getByText("0→+6")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider", { name: "Kick tune" }), { target: { value: "-3" } });
  expect(screen.getByText("-3→+3")).toBeInTheDocument();
});

it.each(["Kick", "Clap", "Bassline", "Lead"])("edits %s tune and decay in settings while keeping level and mute on the card", async (name) => {
  render(<Fixture />);
  expect(screen.getAllByRole("slider")).toHaveLength(14);
  const card = screen.getByRole("region", { name: `${name} voice` });
  const level = within(card).getByRole("slider", { name: `${name} level` });
  fireEvent.change(level, { target: { value: "63" } });
  fireEvent.click(within(card).getByRole("button", { name: `Mute ${name} voice` }));
  const settings = within(card).getByRole("button", { name: /^Configure/ });
  fireEvent.click(settings);
  const dialog = screen.getByRole("dialog");
  const tune = within(dialog).getByRole("slider", { name: `${name} tune` });
  expect(tune).toHaveAttribute("min", "-12");
  expect(tune).toHaveAttribute("max", "12");
  fireEvent.change(tune, { target: { value: "7" } });
  fireEvent.change(within(dialog).getByRole("slider", { name: `${name} decay` }), { target: { value: "31" } });
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(settings).toHaveFocus());
  expect(level).toHaveValue("63");
  expect(within(card).getByRole("button", { name: `Unmute ${name} voice` })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(settings);
  expect(screen.getByRole("slider", { name: `${name} tune` })).toHaveValue("7");
  expect(screen.getByRole("slider", { name: `${name} decay` })).toHaveValue("31");
});

it("keeps tune and decay when resetting custom synthesis", () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Use custom Kick" }));
  fireEvent.click(screen.getByRole("button", { name: "Configure custom Kick" }));
  fireEvent.change(screen.getByRole("slider", { name: "Kick tune" }), { target: { value: "-5" } });
  fireEvent.change(screen.getByRole("slider", { name: "Kick decay" }), { target: { value: "81" } });
  fireEvent.change(screen.getByRole("slider", { name: "Kick Body frequency" }), { target: { value: "64" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset synthesis" }));
  expect(screen.getByRole("slider", { name: "Kick Body frequency" })).toHaveValue("50");
  expect(screen.getByRole("slider", { name: "Kick tune" })).toHaveValue("-5");
  expect(screen.getByRole("slider", { name: "Kick decay" })).toHaveValue("81");
});

it("offers quantized V/Oct and musical scale controls for synth voices", () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Patch Bassline voice" }));
  fireEvent.click(screen.getByRole("button", { name: "Add modulation target" }));
  expect(screen.getByRole("combobox", { name: "Modulation destination for Bassline Quantized V/Oct" })).toHaveValue("vOct");
  fireEvent.change(screen.getByRole("combobox", { name: "Modulation source for Bassline Quantized V/Oct" }), { target: { value: "12" } });
  expect(screen.getByText("F2 · 0.50 V")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(screen.getByRole("button", { name: "Configure Bassline synthesizer" }));
  expect(screen.getByRole("combobox", { name: "Bassline Root note" })).toHaveValue("0");
  expect(screen.getByRole("combobox", { name: "Bassline Scale" })).toHaveValue("2");
  fireEvent.change(screen.getByRole("combobox", { name: "Bassline Scale" }), { target: { value: "5" } });
  expect(screen.getByRole("combobox", { name: "Bassline Scale" })).toHaveValue("5");
});

it.each([
  ["Kick", "Body harmonics", "65"], ["Kick", "Body level", "70"], ["Kick", "Body attack", "8"], ["Snare", "Body length", "350"],
  ["Clap", "Burst length", "40"], ["Rim", "Partial balance", "25"],
  ["Clap", "Tail filter", "700"], ["Clap", "Tail attack", "20"],
  ["Cowbell", "Partial balance", "75"], ["Closed hat", "Brightness", "6000"],
  ["Cowbell", "High damping", "65"],
  ["Open hat", "Brightness", "7000"], ["Cymbal", "Brightness", "8000"],
  ["Closed hat", "Metal focus", "4500"], ["Open hat", "Metal focus", "6500"], ["Cymbal", "Metal focus", "8000"],
  ["Closed hat", "Metal resonance", "3.2"], ["Open hat", "Metal resonance", "1.5"], ["Cymbal", "Metal resonance", "0.5"],
  ["Low tom", "Overtone", "40"], ["Mid tom", "Overtone", "50"], ["Hi tom", "Overtone", "60"],
  ["Low tom", "Overtone ratio", "2.25"], ["Mid tom", "Overtone ratio", "1.75"], ["Hi tom", "Overtone ratio", "3"],
  ["Low tom", "Overtone length", "80"], ["Mid tom", "Overtone length", "350"], ["Hi tom", "Overtone length", "800"],
  ["Bassline", "Amplitude length", "900"], ["Lead", "Filter decay", "200"], ["Lead", "Sub oscillator", "35"],
  ["Open hat", "Choke release", "25"], ["Bassline", "Accent brightness", "70"], ["Bassline", "Accent length", "40"],
  ["Bassline", "Glide", "125"], ["Lead", "Glide", "200"],
  ["Rim", "Noise length", "90"], ["Closed hat", "Metal length", "100"],
  ["Open hat", "Metal length", "900"], ["Cymbal", "Metal length", "2200"],
  ["Cymbal", "Bell level", "35"], ["Cymbal", "Bell pitch", "1100"], ["Cymbal", "Bell length", "900"],
  ["Cymbal", "Stick level", "40"], ["Cymbal", "Stick filter", "6000"], ["Cymbal", "Stick length", "25"],
  ["Bassline", "Filter tracking", "100"], ["Lead", "Filter tracking", "50"],
  ["Snare", "Pitch sweep", "1.75"], ["Snare", "Pitch decay", "45"], ["Snare", "Noise attack", "8"],
  ["Bassline", "Pulse width", "25"], ["Lead", "Pulse width", "70"],
  ["Shaker", "Grain depth", "65"], ["Shaker", "Grain rate", "90"],
])("retains the new %s %s control when reopening its editor", (name, label, value) => {
  render(<Fixture />);
  const card = screen.getByRole("region", { name: `${name} voice` });
  const next909 = within(card).queryByRole("button", { name: `Use 909 ${name}` });
  if (next909) fireEvent.click(next909);
  const custom = within(card).queryByRole("button", { name: `Use custom ${name}` });
  if (custom) fireEvent.click(custom);
  fireEvent.click(within(card).getByRole("button", { name: /^Configure/ }));
  const slider = screen.getByRole("slider", { name: `${name} ${label}` });
  const original = slider.getAttribute("value");
  fireEvent.change(slider, { target: { value } });
  expect(screen.getByRole("spinbutton", { name: `${name} ${label} value` })).toHaveValue(Number(value));
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(within(card).getByRole("button", { name: /^Configure/ }));
  expect(screen.getByRole("slider", { name: `${name} ${label}` })).toHaveValue(value);
  fireEvent.click(screen.getByRole("button", { name: "Reset synthesis" }));
  expect(screen.getByRole("slider", { name: `${name} ${label}` })).toHaveValue(original);
});

it("edits and retains open-hat choking across 909, Custom and 808 models", () => {
  render(<Fixture />);
  const card = screen.getByRole("region", { name: "Open hat voice" });
  for (const next of ["custom", "808", "909"]) {
    fireEvent.click(within(card).getByRole("button", { name: /^Configure/ }));
    const mode = screen.getByRole("combobox", { name: "Open hat Choke by" });
    expect(mode).toHaveValue(next === "custom" ? "0" : "1");
    fireEvent.change(mode, { target: { value: "1" } });
    fireEvent.change(screen.getByRole("slider", { name: "Open hat Choke release" }), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(within(card).getByRole("button", { name: `Use ${next} Open hat` }));
  }
  fireEvent.click(within(card).getByRole("button", { name: /^Configure/ }));
  expect(screen.getByRole("combobox", { name: "Open hat Choke by" })).toHaveValue("1");
  expect(screen.getByRole("slider", { name: "Open hat Choke release" })).toHaveValue("35");
  expect(screen.queryByRole("slider", { name: "Open hat Metal level" })).not.toBeInTheDocument();
});

it("offers Level modulation as a bassline accent source and resets it with synthesis", () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Configure Bassline synthesizer" }));
  const source = screen.getByRole("combobox", { name: "Bassline Accent source" });
  expect(source).toHaveValue("0");
  fireEvent.change(source, { target: { value: "1" } });
  expect(source).toHaveValue("1");
  fireEvent.change(screen.getByRole("slider", { name: "Bassline Accent brightness" }), { target: { value: "75" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset synthesis" }));
  expect(source).toHaveValue("0");
  expect(screen.getByRole("slider", { name: "Bassline Accent brightness" })).toHaveValue("0");
});

it.each(["Bassline", "Lead"])("retains %s mono playback when reopening, and resets it with synthesis", (name) => {
  render(<Fixture />);
  const configure = screen.getByRole("button", { name: `Configure ${name} synthesizer` });
  fireEvent.click(configure);
  const mode = screen.getByRole("combobox", { name: `${name} Playback` });
  expect(mode).toHaveValue("0");
  fireEvent.change(mode, { target: { value: "1" } });
  fireEvent.change(screen.getByRole("slider", { name: `${name} Glide` }), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(configure);
  expect(screen.getByRole("combobox", { name: `${name} Playback` })).toHaveValue("1");
  expect(screen.getByRole("slider", { name: `${name} Glide` })).toHaveValue("100");
  fireEvent.click(screen.getByRole("button", { name: "Reset synthesis" }));
  expect(screen.getByRole("combobox", { name: `${name} Playback` })).toHaveValue("0");
  expect(screen.getByRole("slider", { name: `${name} Glide` })).toHaveValue("0");
});

it("edits, retains and resets the rim's independent noise envelope", () => {
  render(<Fixture />);
  const card = screen.getByRole("region", { name: "Rim voice" });
  const next909 = within(card).queryByRole("button", { name: "Use 909 Rim" });
  if (next909) fireEvent.click(next909);
  fireEvent.click(within(card).getByRole("button", { name: "Use custom Rim" }));
  const configure = within(card).getByRole("button", { name: /^Configure/ });
  fireEvent.click(configure);
  const mode = screen.getByRole("combobox", { name: "Rim Noise envelope" });
  expect(mode).toHaveValue("0");
  fireEvent.change(mode, { target: { value: "1" } });
  fireEvent.change(screen.getByRole("slider", { name: "Rim Noise length" }), { target: { value: "90" } });
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(configure);
  expect(screen.getByRole("combobox", { name: "Rim Noise envelope" })).toHaveValue("1");
  expect(screen.getByRole("slider", { name: "Rim Noise length" })).toHaveValue("90");
  fireEvent.click(screen.getByRole("button", { name: "Reset synthesis" }));
  expect(screen.getByRole("combobox", { name: "Rim Noise envelope" })).toHaveValue("0");
  expect(screen.getByRole("slider", { name: "Rim Noise length" })).toHaveValue("20");
});
