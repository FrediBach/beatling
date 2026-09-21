import { memo, useEffect, useRef } from "react";
import type { OutputAnalysis } from "@/audio/engine";

const BAND_COUNT = 48;
const MIN_WIDTH = 120;
const FRAME_INTERVAL = 1000 / 30;

function spectrumPainter(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, analysis: OutputAnalysis) {
  const data = new Uint8Array(analysis.binCount);
  const peaks = new Float32Array(BAND_COUNT);
  const bins = new Uint16Array(BAND_COUNT + 1);
  const highest = Math.min(16000, analysis.sampleRate / 2);
  for (let band = 0; band <= BAND_COUNT; band += 1) {
    const frequency = 40 * (highest / 40) ** (band / BAND_COUNT);
    bins[band] = Math.min(data.length - 1, Math.round(frequency * data.length * 2 / analysis.sampleRate));
  }
  let lastFrame = -Infinity;
  return (time: number) => {
    if (time - lastFrame < FRAME_INTERVAL) return;
    lastFrame = time;
    analysis.read(data);
    const { width, height } = canvas;
    const spacing = width / BAND_COUNT;
    const stroke = Math.max(1, Math.round(spacing * 0.22));
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#c74728";
    for (let band = 0; band < BAND_COUNT; band += 1) {
      let level = 0;
      const end = Math.max(bins[band] + 1, bins[band + 1]);
      for (let bin = bins[band]; bin < end; bin += 1) level = Math.max(level, data[bin] / 255);
      // Taper the ends and mirror around the center for a quiet ribbon of sound.
      const envelope = 0.35 + 0.65 * Math.sin(Math.PI * (band + 0.5) / BAND_COUNT);
      const amplitude = level * envelope * height * 0.4;
      peaks[band] = Math.max(amplitude, peaks[band] * 0.94);
      const x = Math.round((band + 0.5) * spacing);
      context.globalAlpha = 0.45;
      context.fillRect(x, height / 2 - amplitude, stroke, Math.max(stroke, amplitude * 2));
      context.globalAlpha = 0.16;
      context.fillRect(x, height / 2 - peaks[band], stroke, stroke);
      context.fillRect(x, height / 2 + peaks[band], stroke, stroke);
    }
  };
}

export const OutputSpectrum = memo(function OutputSpectrum({ playing, observeOutput }: {
  playing: boolean;
  observeOutput: () => OutputAnalysis | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!playing || !canvas || !window.ResizeObserver || !window.IntersectionObserver) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let visible = false;
    let frame = 0;
    let analysis: OutputAnalysis | null = null;
    let context: CanvasRenderingContext2D | null = null;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      analysis?.disconnect();
      analysis = null;
      context?.clearRect(0, 0, canvas.width, canvas.height);
    };
    const sync = () => {
      if (width < MIN_WIDTH || !height || !visible || document.hidden || motion.matches) { stop(); return; }
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      if (analysis) return;
      context ??= canvas.getContext("2d");
      if (!context) return;
      analysis = observeOutput();
      if (!analysis) return;
      const paint = spectrumPainter(canvas, context, analysis);
      const draw = (time: number) => {
        paint(time);
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      sync();
    });
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    resize.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      stop();
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, [playing, observeOutput]);
  return <div className="output-spectrum" aria-hidden="true"><canvas ref={canvasRef} /></div>;
});
