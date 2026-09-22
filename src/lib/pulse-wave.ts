import { clamp } from "./euclid";

const HARMONICS = 2048;

/** Fourier coefficients of a pulse with its DC component removed. */
export function pulseWaveCoefficients(widthPercent: number) {
  const duty = clamp(widthPercent, 10, 90) / 100;
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  // Start at the rising edge, matching the native square's phase at 50%.
  // Index zero stays zero; PeriodicWave performs peak normalization.
  for (let harmonic = 1; harmonic <= HARMONICS; harmonic++) {
    const angle = 2 * Math.PI * harmonic * duty;
    const scale = 2 / (Math.PI * harmonic);
    real[harmonic] = scale * Math.sin(angle);
    imag[harmonic] = scale * (1 - Math.cos(angle));
  }
  return { real, imag };
}
