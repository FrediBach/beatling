import type { ReactNode } from "react";
import { VOICE_DEFS } from "@/lib/constants";
import { NOTE_NAMES, SCALE_DEFS } from "@/lib/quantizer";
import { PROFILES } from "@/lib/musical-randomizer/profiles";
import { defaultRequest, type MusicalRequest } from "@/lib/musical-randomizer/types";
import type { Patch, VoiceId } from "@/lib/types";

interface QuestionsProps { request: MusicalRequest; source: Patch; onChange: (request: MusicalRequest) => void }

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <fieldset className="musical-choice"><legend>{label}</legend><div>{options.map(([id, name]) => <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)}>{name}</button>)}</div></fieldset>;
}

export function MusicalDirection({ request, source, onChange }: QuestionsProps) {
  const set = <K extends keyof MusicalRequest>(key: K, value: MusicalRequest[K]) => onChange({ ...request, [key]: value });
  return <div className="musical-questions">
    <Choice label="Where should we start?" value={request.mode} options={[["new", "Create a new groove"], ["reshape", "Reshape this patch"]]} onChange={(mode) => onChange(defaultRequest(source, mode))} />
    <p className="musical-note">{request.mode === "new" ? "Compose a new pattern around your locked and kept parts. Selected voices receive coordinated sounds." : "Develop the current pattern while keeping its sounds, routing, mutes, and authored rhythm series."}</p>
    <Choice label="What kind of groove?" value={request.profile} options={Object.entries(PROFILES).map(([id, profile]) => [id as MusicalRequest["profile"], profile.name])} onChange={(profile) => onChange({ ...request, profile, bpm: request.mode === "new" ? PROFILES[profile].bpm : request.bpm })} />
    <p className="musical-note">{PROFILES[request.profile].description}</p>
    <Choice label="How much activity?" value={request.density} options={[[0, "Spacious"], [1, "Balanced"], [2, "Busy"]]} onChange={(value) => set("density", value)} />
    <MusicalParts request={request} onChange={onChange} />
  </div>;
}

function MusicalParts({ request, onChange }: Pick<QuestionsProps, "request" | "onChange">) {
  const selected = new Set(request.parts);
  const kept = new Set(request.keep);
  const toggle = (field: "parts" | "keep", voice: VoiceId, checked: boolean) => onChange({ ...request, [field]: checked ? [...request[field], voice] : request[field].filter((id) => id !== voice) });
  return <fieldset className="musical-parts"><legend>Parts to include</legend><p className="musical-note">{request.mode === "reshape" ? "Unselected parts remain unchanged." : "Unselected parts are removed unless locked or kept."} Keep protects the complete part and its dependencies.</p><div className="musical-parts-grid">{VOICE_DEFS.map(({ id, name }) => <div className="musical-part" key={id}>
    <label><input type="checkbox" checked={selected.has(id)} onChange={(event) => toggle("parts", id, event.target.checked)} />{name}</label>
    <label className="musical-keep"><input type="checkbox" aria-label={`Keep ${name}`} checked={kept.has(id)} onChange={(event) => toggle("keep", id, event.target.checked)} />Keep</label>
  </div>)}</div></fieldset>;
}

export function MusicalCharacter({ request, source, onChange }: QuestionsProps) {
  const set = <K extends keyof MusicalRequest>(key: K, value: MusicalRequest[K]) => onChange({ ...request, [key]: value });
  const hasSynth = request.parts.some((id) => id === "bassline" || id === "lead");
  return <div className="musical-questions">
    <Choice label="How syncopated?" value={request.syncopation} options={[[0, "Grounded"], [1, "Some bounce"], [2, "Adventurous"]]} onChange={(value) => set("syncopation", value)} />
    <Choice label="What timing feel?" value={request.swing} options={[["straight", "Straight"], ["light", "Light swing"], ["strong", "Strong swing"], ["keep", "Keep current"]]} onChange={(value) => set("swing", value)} />
    <Choice label="How much development?" value={request.development} options={[[0, "Repeating loop"], [1, "Small changes"], [2, "Evolving phrase"]]} onChange={(value) => set("development", value)} />
    {request.mode === "reshape" && <Choice label="Change amount" value={request.change} options={[[0, "Subtle"], [1, "Moderate"], [2, "Bold"]]} onChange={(value) => set("change", value)} />}
    <div className="musical-settings">
      <Field label="Tempo"><input type="number" min={20} max={300} value={request.bpm} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) set("bpm", Math.max(20, Math.min(300, event.target.valueAsNumber))); }} /></Field>
      {hasSynth && <>
        <Field label="Tonal settings"><select value={request.harmony} onChange={(event) => set("harmony", event.target.value as MusicalRequest["harmony"])}><option value="shared">Use a shared key</option><option value="keep">Keep existing tuning</option></select></Field>
        {request.harmony === "shared" && <>
          <Field label="Key"><select value={request.root} onChange={(event) => set("root", Number(event.target.value))}>{NOTE_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></Field>
          <Field label="Scale"><select value={request.scale} onChange={(event) => set("scale", Number(event.target.value))}>{SCALE_DEFS.map(({ name }, index) => <option key={name} value={index}>{name}</option>)}</select></Field>
        </>}
      </>}
    </div>
    {hasSynth && request.mode === "reshape" && <label className="musical-checkbox"><input type="checkbox" checked={request.reshapeMelody} onChange={(event) => set("reshapeMelody", event.target.checked)} />Also reshape compatible pitch motion</label>}
    <p className="musical-note">{request.mode === "reshape" ? `Current clock rate is retained (${source.rate} pulses per beat). Muted parts stay muted. Shared-key changes preserve existing Tune and modulation, which can transpose notes further.` : "New grooves use a sixteenth-note clock. Protected parts retain their timing and effects. Master volume stays unchanged."}</p>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="musical-field"><span>{label}</span>{children}</label>;
}
