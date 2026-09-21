import { describe, expect, it } from "vitest";
import { createEmptyPatch } from "@/lib/patch";
import { quantizeVoiceCv } from "./quantizer";

describe("voice CV quantizer", () => {
  it("maps one volt per octave and snaps to the selected scale", () => {
    const settings = { ...createEmptyPatch().voices.lead.custom, root: 0, scale: 1, octave: 3 };
    expect(quantizeVoiceCv(settings, 0).name).toBe("C3");
    expect(quantizeVoiceCv(settings, 1 / 12).name).toBe("C3");
    expect(quantizeVoiceCv(settings, 2 / 12).name).toBe("D3");
    expect(quantizeVoiceCv(settings, 1).name).toBe("C4");
    expect(quantizeVoiceCv(settings, -2 / 12).name).toBe("A2");
  });

  it("applies root, octave, negative voltage, and tune after quantization", () => {
    const settings = { ...createEmptyPatch().voices.bassline.custom, root: 9, scale: 5, octave: 2 };
    const note = quantizeVoiceCv(settings, 7 / 12, 2);
    expect(note.name).toBe("F♯3");
    expect(note.offset).toBe(7);
    expect(note.frequency).toBeCloseTo(185, 1);
  });
});
