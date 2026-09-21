import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  expect(screen.getByText("0→+6")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  const input = screen.getByRole("button", { name: /^Inputs to voice Kick: 1 connection/ });
  expect(input.title).toContain("Block 13 LFO → voice Kick Tune");
  expect(container.querySelector('[data-voice-id="kick"] [data-cable-port="in-Mod-Tune"]')).not.toBeNull();
});
