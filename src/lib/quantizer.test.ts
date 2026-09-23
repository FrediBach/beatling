import { describe, expect, it } from "vitest";
import { createEmptyPatch } from "@/lib/patch";
import { euclideanScale, quantizeEuclideanCv, quantizeVoiceCv } from "./quantizer";

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

it("bypasses voice snapping while retaining root, octave and fractional Tune", () => {
  const settings = { quantizer: 0, root: 2, octave: 3, scale: 1 };
  expect(quantizeVoiceCv(settings, 1.25 / 12, 0.5).midi).toBe(51.75);
  expect(quantizeVoiceCv({ ...settings, quantizer: 1 }, 1.25 / 12, 0.5).midi).toBe(52.5);
  expect(quantizeVoiceCv(settings, -1 / 12).midi).toBe(49);
});

describe("Euclidean scales", () => {
  const rhythm = { steps: 12, pulses: 7, rot: 0 };
  it("spreads scale degrees with the same Euclidean math as rhythms", () => {
    expect(euclideanScale(rhythm)).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(euclideanScale({ ...rhythm, rot: 1 })).toEqual([1, 3, 5, 6, 8, 10, 11]);
    expect(euclideanScale({ steps: 5, pulses: 5, rot: 0 })).toEqual([0, 2.4, 4.8, 7.2, 9.6]);
  });
  it("snaps across octave boundaries, choosing the lower pitch for ties", () => {
    expect(quantizeEuclideanCv(rhythm, 1 / 12)).toBe(0);
    expect(quantizeEuclideanCv(rhythm, 3.2 / 12)).toBe(4 / 12);
    expect(quantizeEuclideanCv(rhythm, -1 / 12)).toBe(-1 / 12);
    expect(quantizeEuclideanCv(rhythm, 1)).toBe(1);
    expect(quantizeEuclideanCv({ steps: 12, pulses: 1, rot: 1 }, 0)).toBe(-1 / 12);
  });
  it("passes empty scales through and keeps microtonal divisions", () => {
    expect(quantizeEuclideanCv({ ...rhythm, pulses: 0 }, 0.123)).toBeCloseTo(0.123);
    expect(quantizeEuclideanCv({ steps: 5, pulses: 5, rot: 0 }, 0.19)).toBeCloseTo(0.2);
  });
});
