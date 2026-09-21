import { EffectControl } from "@/components/effect-control";
import { compressedDb, createEffects, DELAY_DIVISIONS, delaySeconds, distortionSample, REVERB_SECONDS, waveguideFrequency } from "@/lib/effects";
import type { EffectId, EffectsState } from "@/lib/types";

const DEFAULTS = createEffects();
// Echo number is the stable identity of each fixed preview tap.
const ECHO_NUMBERS = [0, 1, 2, 3, 4, 5, 6];
type Props<Id extends EffectId> = { value: EffectsState[Id]; onChange: (changes: Partial<EffectsState[Id]>) => void };
type NumericKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

function Controls<Id extends EffectId>({ id, value, onChange, fields }: Props<Id> & { id: Id; fields: { key: NumericKey<EffectsState[Id]>; label: string; min: number; max: number; step?: number; suffix: string; knob?: boolean }[] }) {
  const name = id === "karplus" ? "Karplus–Strong" : id[0].toUpperCase() + id.slice(1);
  return <div className="effect-parameters">{fields.map(({ key, ...field }) => <EffectControl key={String(key)} {...field} accessibleLabel={`${name} ${field.label}`} value={Number(value[key])} defaultValue={Number(DEFAULTS[id][key])} onChange={(next) => onChange({ [key]: next } as Partial<EffectsState[Id]>)} />)}</div>;
}

function Choices<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <fieldset className="effect-choices"><legend>{label}</legend><div>{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></fieldset>;
}

function Preview({ points, caption }: { points: string; caption: string }) {
  return <figure className="effect-preview"><svg viewBox="0 0 300 80" aria-hidden="true"><path className="effect-preview-grid" d="M0 40H300 M150 0V80" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg><figcaption>{caption}</figcaption></figure>;
}

function DistortionEditor({ value, onChange }: Props<"distortion">) {
  const points = Array.from({ length: 101 }, (_, i) => `${i * 3},${40 - distortionSample(i / 50 - 1, value) * 34}`).join(" ");
  return <>
    <Choices label="Character" value={value.mode} options={[{ value: "soft", label: "Soft" }, { value: "hard", label: "Hard clip" }, { value: "fold", label: "Wavefold" }]} onChange={(mode) => onChange({ mode })} />
    <Preview points={points} caption={value.mode === "fold" ? "Fold peaks into metallic overtones." : value.mode === "hard" ? "Flatten peaks for a sharp, gritty edge." : "Round peaks into warm saturation."} />
    <Controls id="distortion" value={value} onChange={onChange} fields={[
      { key: "drive", label: "Drive", min: 0, max: 100, suffix: "%", knob: true },
      { key: "tone", label: "Tone", min: 400, max: 16000, step: 100, suffix: "Hz" },
      { key: "trim", label: "Output trim", min: -24, max: 6, step: 0.5, suffix: "dB" },
    ]} />
  </>;
}

function ReverbEditor({ value, onChange }: Props<"reverb">) {
  const seconds = REVERB_SECONDS[value.space];
  const start = value.preDelay / 4000 * 300;
  const points = Array.from({ length: 81 }, (_, i) => `${start + i / 80 * seconds / 4 * 300},${74 - (1 - i / 80) ** 2.6 * 66}`).join(" ");
  return <>
    <Choices label="Space / tail length" value={value.space} options={[{ value: "room", label: "Room · 0.6 s" }, { value: "studio", label: "Studio · 1.8 s" }, { value: "hall", label: "Hall · 3.6 s" }]} onChange={(space) => onChange({ space })} />
    <Preview points={points} caption={`${value.preDelay} ms before a ${seconds} s tail. Pre-delay keeps the first hit clear.`} />
    <Controls id="reverb" value={value} onChange={onChange} fields={[
      { key: "preDelay", label: "Pre-delay", min: 0, max: 200, suffix: "ms" },
      { key: "damping", label: "Damping", min: 1000, max: 16000, step: 100, suffix: "Hz" },
      { key: "lowCut", label: "Low cut", min: 0, max: 2000, step: 20, suffix: "Hz" },
    ]} />
    <p className="effect-hint">Lower damping darkens the tail. Low cut removes bass from the room; 0 leaves it full. Changing space starts a fresh tail.</p>
  </>;
}

function DelayEditor({ value, onChange, bpm }: Props<"delay"> & { bpm: number }) {
  const seconds = delaySeconds(value, bpm);
  return <>
    <Choices label="Clock" value={value.sync ? "sync" : "free"} options={[{ value: "free", label: "Free time" }, { value: "sync", label: "Tempo sync" }]} onChange={(mode) => onChange({ sync: mode === "sync" })} />
    {value.sync && <Choices label="Note division" value={value.division} options={DELAY_DIVISIONS} onChange={(division) => onChange({ division })} />}
    <figure className="effect-preview"><svg viewBox="0 0 300 80" aria-hidden="true">{ECHO_NUMBERS.map((echo) => <path key={echo} d={`M${12 + echo * 44} 74v-${66 * (value.feedback / 100) ** echo}`} stroke="currentColor" strokeWidth="3" />)}</svg><figcaption>{Math.round(seconds * 1000)} ms between repeats{value.sync ? ` · ${bpm} BPM` : ""}</figcaption></figure>
    <Controls id="delay" value={value} onChange={onChange} fields={[
      ...(!value.sync ? [{ key: "time" as const, label: "Time", min: 40, max: 2000, step: 5, suffix: "ms" }] : []),
      { key: "feedback", label: "Feedback", min: 0, max: 85, suffix: "%" },
      { key: "tone", label: "Tone", min: 500, max: 12000, step: 100, suffix: "Hz" },
      { key: "lowCut", label: "Low cut", min: 0, max: 2000, step: 20, suffix: "Hz" },
    ]} />
    <p className="effect-hint">Tone and low cut shape every repeat. Free time is remembered when you switch clocks.</p>
  </>;
}

function KarplusEditor({ value, onChange }: Props<"karplus">) {
  const hz = waveguideFrequency(value.tune) * 2 ** value.octave;
  return <>
    <Choices label="Model" value={value.model} options={[{ value: "string", label: "String" }, { value: "tube", label: "Tube" }]} onChange={(model) => onChange({ model })} />
    <div className="effect-pitch"><span>Target tuning</span><strong>{hz.toFixed(1)} <small>Hz</small></strong><span>{hz < 20 ? "Echo range" : value.model === "tube" ? "Hollow tube resonance" : "Plucked string resonance"}</span></div>
    <Choices label="Octave" value={value.octave} options={[-2, -1, 0, 1, 2].map((octave) => ({ value: octave, label: octave > 0 ? `+${octave}` : String(octave) }))} onChange={(octave) => onChange({ octave })} />
    <Controls id="karplus" value={value} onChange={onChange} fields={[
      { key: "tune", label: "Tune", min: 0, max: 100, suffix: "%", knob: true },
      { key: "body", label: "Body", min: 0, max: 100, suffix: "%" },
      { key: "decay", label: "Decay", min: 0, max: 100, suffix: "%" },
      { key: "excitation", label: "Excitation", min: 200, max: 16000, step: 100, suffix: "Hz" },
    ]} />
    <p className="effect-hint">Excitation softens the strike; its maximum opens the filter. Body brightens the ringing tail. Damping shifts pitch; high settings can reach the resonance limit.</p>
  </>;
}

function CompressorEditor({ value, onChange }: Props<"compressor">) {
  const points = Array.from({ length: 61 }, (_, i) => `${i * 5},${74 - (compressedDb(i - 60, value.threshold, value.ratio, value.knee) + 60) / 60 * 68}`).join(" ");
  return <>
    <Preview points={points} caption="Input → output before makeup · a softer knee eases into compression." />
    <fieldset className="effect-section"><legend>Dynamics</legend><Controls id="compressor" value={value} onChange={onChange} fields={[
      { key: "threshold", label: "Threshold", min: -60, max: 0, suffix: "dB" },
      { key: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5, suffix: ":1" },
      { key: "knee", label: "Knee", min: 0, max: 40, suffix: "dB" },
    ]} /></fieldset>
    <fieldset className="effect-section"><legend>Envelope & gain</legend><Controls id="compressor" value={value} onChange={onChange} fields={[
      { key: "attack", label: "Attack", min: 0, max: 100, suffix: "ms" },
      { key: "release", label: "Release", min: 50, max: 1000, step: 10, suffix: "ms" },
      { key: "makeup", label: "Makeup", min: 0, max: 18, step: 0.5, suffix: "dB" },
    ]} /></fieldset>
    <p className="effect-hint">Slow attack lets transients through. Raise makeup for sustain, then blend with Return.</p>
  </>;
}

export function EffectProcessor({ id, value, bpm, onChange }: { id: EffectId; value: EffectsState; bpm: number; onChange: (value: EffectsState) => void }) {
  switch (id) {
    case "distortion": return <DistortionEditor value={value.distortion} onChange={(changes) => onChange({ ...value, distortion: { ...value.distortion, ...changes } })} />;
    case "reverb": return <ReverbEditor value={value.reverb} onChange={(changes) => onChange({ ...value, reverb: { ...value.reverb, ...changes } })} />;
    case "delay": return <DelayEditor value={value.delay} bpm={bpm} onChange={(changes) => onChange({ ...value, delay: { ...value.delay, ...changes } })} />;
    case "karplus": return <KarplusEditor value={value.karplus} onChange={(changes) => onChange({ ...value, karplus: { ...value.karplus, ...changes } })} />;
    case "compressor": return <CompressorEditor value={value.compressor} onChange={(changes) => onChange({ ...value, compressor: { ...value.compressor, ...changes } })} />;
  }
}
