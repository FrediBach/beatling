import type { ReactNode } from "react";
import type { CustomVoiceSettings } from "@/lib/types";
import { shakerTextureCurve } from "@/lib/shaker-texture";
import type { VoiceDiagramKind } from "./voice-editor-layout";

function Diagram({ children, caption }: { children: ReactNode; caption: string }) {
  return <figure className="voice-diagram">
    <svg viewBox="0 0 320 76" aria-hidden="true">
      <path className="voice-diagram-grid" d="M8 64H312 M8 8V64" />
      {children}
    </svg>
    <figcaption>{caption}</figcaption>
  </figure>;
}

function PitchDiagram({ value: v }: { value: CustomVoiceSettings }) {
  const base = v.bodyFrequency ?? v.toneFrequency;
  const end = 8 + v.pitchDecay / 300 * 304;
  const start = 60 - Math.log2(v.pitchAmount) / Math.log2(12) * 48;
  return <Diagram caption={`Pitch sketch · ${Math.round(base * v.pitchAmount)} → ${base} Hz in ${v.pitchDecay} ms, before Tune.`}>
    <path d={`M8 ${start} Q${8 + (end - 8) * 0.35} 60 ${end} 60 H312`} className="voice-diagram-line" />
    <path d={`M${end} 8V64`} className="voice-diagram-grid" />
    <text x="12" y="16">STRIKE</text><text x="308" y="49" textAnchor="end">BODY PITCH</text>
  </Diagram>;
}

function PartialDiagram({ value: v }: { value: CustomVoiceSettings }) {
  return <Diagram caption={`Partial blend · ${100 - v.balance}% low / ${v.balance}% high. Frequencies shown before Tune.`}>
    <rect x="8" y="24" width={304 * (1 - v.balance / 100)} height="20" className="voice-diagram-fill" />
    <rect x={8 + 304 * (1 - v.balance / 100)} y="24" width={304 * v.balance / 100} height="20" className="voice-diagram-secondary-fill" />
    <text x="8" y="15">LOW · {v.lowFrequency} Hz</text>
    <text x="312" y="15" textAnchor="end">HIGH · {v.highFrequency} Hz</text>
    <path d="M160 20V48" className="voice-diagram-grid" />
  </Diagram>;
}

function BurstDiagram({ value: v }: { value: CustomVoiceSettings }) {
  // Burst number identifies a fixed slot, also when the visible count changes.
  const bursts = [0, 1, 2, 3, 4, 5].slice(0, v.burstCount);
  return <Diagram caption={`${v.burstCount} bursts · ${v.burstSpacing} ms apart · ${v.burstDecay} ms each. Tail starts on the last burst.`}>
    {bursts.map((burst) => {
      const x = 8 + burst * v.burstSpacing / 210 * 304;
      const end = x + v.burstDecay / 210 * 304;
      return <path key={burst} d={`M${x} 64V${64 - v.burstLevel * .5} Q${x + 5} 62 ${end} 64`} className="voice-diagram-line" />;
    })}
  </Diagram>;
}

function MetalDiagram({ value: v }: { value: CustomVoiceSettings }) {
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
  return <Diagram caption={`Oscillator fundamentals · ${v.metalBase} Hz × six ratios. Filtering shapes their upper harmonics.`}>
    {ratios.map((ratio) => <path key={ratio} d={`M${8 + v.metalBase * ratio / 1000 * 304} 64v-${v.metalLevel * .5}`} className="voice-diagram-line" />)}
    <text x="12" y="16">LOWER</text><text x="308" y="16" textAnchor="end">HIGHER</text>
  </Diagram>;
}

function TextureDiagram({ value: v }: { value: CustomVoiceSettings }) {
  const curve = shakerTextureCurve(v.grainDepth / 100, v.grainRate, .1, 1);
  const points = Array.from(curve, (level, index) => `${8 + index / (curve.length - 1) * 304},${60 - level * 48}`).join(" ");
  return <Diagram caption={`Grain shape · 100 ms example at ${v.grainRate} pulses/s. ${v.grainDepth === 0 ? "Depth 0 keeps a smooth swish." : "Deeper valleys give a more pronounced rattle."}`}>
    <polyline points={points} className="voice-diagram-line" />
  </Diagram>;
}

function OscillatorDiagram({ value: v }: { value: CustomVoiceSettings }) {
  const points = Array.from({ length: 241 }, (_, index) => {
    const phase = (index / 240 * 3) % 1;
    const amplitude = v.waveform === 1 ? (phase < v.pulseWidth / 100 ? 1 : -1) : v.waveform === 2 ? 1 - 4 * Math.abs(phase - .5) : phase * 2 - 1;
    return `${8 + index / 240 * 304},${36 - amplitude * 23}`;
  }).join(" ");
  const name = ["Saw", "Square", "Triangle"][v.waveform];
  return <Diagram caption={`Main waveform sketch · ${name}${v.waveform === 1 ? ` · ${v.pulseWidth}% pulse width` : ""}.`}>
    <polyline points={points} className="voice-diagram-line" />
  </Diagram>;
}

export function VoiceDiagram({ kind, value }: { kind: VoiceDiagramKind; value: CustomVoiceSettings }) {
  switch (kind) {
    case "pitch": return <PitchDiagram value={value} />;
    case "partials": return <PartialDiagram value={value} />;
    case "bursts": return <BurstDiagram value={value} />;
    case "metal": return <MetalDiagram value={value} />;
    case "texture": return <TextureDiagram value={value} />;
    case "oscillator": return <OscillatorDiagram value={value} />;
  }
}
