import { clamp } from "./euclid";

const CURVE_SAMPLES = 1024;

// Indexed noise keeps texture reproducible without consuming rhythm randomness.
function grainRandom(seed: number, index: number): number {
  let value = seed ^ Math.imul(index + 1, 0x9e3779b9);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
}

/** A bounded gain curve; depth is 0–1, rate is grains/second, duration is seconds. */
export function shakerTextureCurve(depth: number, rate: number, duration: number, seed: number) {
  const amount = clamp(depth, 0, 1);
  const frequency = clamp(rate, 20, 120);
  const curve = new Float32Array(CURVE_SAMPLES);
  if (amount === 0) return curve.fill(1);
  for (let i = 0; i < curve.length; i++) {
    const position = i / (curve.length - 1) * duration * frequency;
    const grain = Math.floor(position);
    const phase = position - grain;
    const peak = 0.25 + grainRandom(seed, grain * 2) * 0.5;
    const level = 0.7 + grainRandom(seed, grain * 2 + 1) * 0.3;
    const progress = phase < peak ? phase / peak : (1 - phase) / (1 - peak);
    // Smooth joins, with varying crest position and height in each grain.
    const pulse = Math.sin(Math.PI / 2 * progress) ** 2 * level;
    curve[i] = 1 - amount + amount * pulse;
  }
  return curve;
}
