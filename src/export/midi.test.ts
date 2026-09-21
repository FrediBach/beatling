import { describe, expect, it } from "vitest";
import { buildMidi } from "@/export/midi";
import { createEmptyPatch } from "@/lib/patch";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("MIDI export", () => {
  it("creates a format-one MIDI file with tempo and a GM drum track", () => {
    const patch = createEmptyPatch();
    patch.bpm = 120;
    patch.blocks[0].pulses = 4;
    patch.blocks[0].prob = 100;
    const midi = buildMidi(patch);

    expect(text(midi.slice(0, 4))).toBe("MThd");
    expect([...midi.slice(8, 14)]).toEqual([0, 1, 0, 2, 1, 224]);
    expect(text(midi)).toContain("MTrk");
    expect([...midi]).toEqual(expect.arrayContaining([0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]));
    expect([...midi]).toEqual(expect.arrayContaining([0x99, 36]));
  });

  it("keeps an empty patch as a valid tempo-only MIDI file", () => {
    const midi = buildMidi(createEmptyPatch());
    expect([...midi.slice(10, 14)]).toEqual([0, 1, 1, 224]);
    expect(text(midi.slice(-4))).not.toBe("");
  });
});
