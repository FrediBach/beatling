import { expect, it } from "vitest";
import { pulseWaveCoefficients } from "./pulse-wave";

it.each([10, 25, 50, 75, 90])("reconstructs a %s%% pulse with no DC offset and bounded coefficients", (width) => {
  const { real, imag } = pulseWaveCoefficients(width);
  expect(real).toHaveLength(2049);
  expect(imag).toHaveLength(real.length);
  expect(real[0]).toBe(0);
  expect(imag[0]).toBe(0);
  expect([...real, ...imag].every((value) => Number.isFinite(value) && Math.abs(value) <= 4 / Math.PI)).toBe(true);
  const sample = (phase: number) => real.reduce((sum, value, harmonic) => sum + value * Math.cos(2 * Math.PI * harmonic * phase) + imag[harmonic] * Math.sin(2 * Math.PI * harmonic * phase), 0);
  const duty = width / 100;
  // Away from the edges the truncated series approaches the DC-free plateaus.
  expect(sample(duty / 2)).toBeCloseTo(2 * (1 - duty), 2);
  expect(sample((1 + duty) / 2)).toBeCloseTo(-2 * duty, 2);
});

it("matches the native square's odd sine series at 50 percent", () => {
  const { real, imag } = pulseWaveCoefficients(50);
  for (let harmonic = 1; harmonic < real.length; harmonic++) {
    expect(real[harmonic]).toBeCloseTo(0, 6);
    expect(imag[harmonic]).toBeCloseTo(harmonic % 2 ? 4 / (Math.PI * harmonic) : 0, 6);
  }
});
