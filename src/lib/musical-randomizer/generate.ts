import { createBlock, createEmptyPatch, createRandomizationLocks, normalizePatch } from "@/lib/patch";
import { ROW_PARAMS, SYNTH_VOICE_IDS, VOICE_DEFS, voiceName } from "@/lib/constants";
import { NOTE_NAMES, SCALE_DEFS } from "@/lib/quantizer";
import type { BlockRandomizationLocks, Patch, SequencerBlock, VoiceId } from "@/lib/types";
import { blockVoices, resolveConstraints, simpleClock } from "./constraints";
import { candidateScore, musicalEvents } from "./evaluate";
import { BASS_PITCH, LEAD_PITCH, PROFILES, choose, rhythmChoices, seededRandom, type RhythmRecipe } from "./profiles";
import type { GenerationResult, MusicalCandidate, MusicalRequest } from "./types";

type Constraints = ReturnType<typeof resolveConstraints>;
const copy = <T,>(value: T): T => structuredClone(value);
const rotation = (offset: number, steps = 16) => (steps - offset % steps) % steps;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function applyRhythm(block: SequencerBlock, recipe: RhythmRecipe, request: MusicalRequest, locks?: BlockRandomizationLocks): SequencerBlock {
  const steps = locks?.steps ? block.steps : 16;
  const pulses = locks?.pulses ? block.pulses : Math.min(steps, recipe.pulses);
  if (pulses > steps) return block;
  const next = { ...block, steps, pulses, rot: locks?.rot ? block.rot : rotation(recipe.offset, steps), prob: locks?.prob ? block.prob : 100 };
  // Existing series and partially locked blocks keep their phrase structure.
  if (request.development && !block.series.length && !locks && block.voice !== "kick" && block.voice !== "snare" && block.voice !== "clap") {
    const bars = request.development === 1 ? 2 : 4;
    next.repeats = bars - 1;
    next.series = [{ id: `${block.rhythmId}-answer`, steps, pulses: block.voice === "lead" ? Math.max(1, pulses - 1) : Math.min(steps, pulses + 1), rot: rotation(recipe.offset + 2, steps), repeats: 1 }];
  }
  return next;
}

function setSound(patch: Patch, voice: VoiceId, request: MusicalRequest) {
  const state = patch.voices[voice];
  state.level = voice === "kick" ? 82 : voice === "bassline" ? 56 : voice === "lead" ? 32 : ["snare", "clap"].includes(voice) ? 55 : 32;
  state.decay = SYNTH_VOICE_IDS.has(voice) ? 35 : voice === "kick" ? 45 : 28;
  if (SYNTH_VOICE_IDS.has(voice)) {
    Object.assign(state.custom, { root: request.root, scale: request.scale, octave: voice === "bassline" ? 2 : 4, cutoff: voice === "bassline" ? 420 : 2200, resonance: voice === "bassline" ? 3 : 1.5, envelopeAmount: 30, filterDecay: 180 });
    state.tune = 0;
  }
}

function newGroove(source: Patch, request: MusicalRequest, constraints: Constraints, seed: number): Patch | null {
  const patch = createEmptyPatch(source.vol);
  const { protectedSlots, protectedVoices, selected } = constraints;
  // A protected part retains all shared voice settings and processing.
  if (protectedSlots.size) {
    patch.rate = source.rate;
    patch.bpm = source.bpm;
    patch.swing = source.swing;
    patch.effects = copy(source.effects);
  } else patch.rate = 4;
  if (patch.rate !== 4) return null;
  patch.blocks = patch.blocks.map((block, slot) => protectedSlots.has(slot) ? copy(source.blocks[slot]) : { ...block, kind: "modulator", voice: "", pulses: 0 });
  for (const voice of protectedVoices) patch.voices[voice] = copy(source.voices[voice]);
  const free = patch.blocks.map((_, slot) => slot).filter((slot) => !protectedSlots.has(slot));
  const take = () => free.shift();
  const addVoice = (voice: VoiceId, recipe: RhythmRecipe, slot: number) => {
    const block = { ...createBlock(slot), kind: "voice" as const, voice };
    patch.blocks[slot] = applyRhythm(block, recipe, request);
    setSound(patch, voice, request);
  };
  // Reserve complete synth pairs before ornamentation. Pitch sources precede
  // their recipients, making startup and note-on sampling deterministic.
  for (const [index, voice] of (["bassline", "lead"] as const).entries()) {
    if (!selected.has(voice) || protectedVoices.has(voice)) continue;
    const pitchSlot = take();
    const voiceSlot = take();
    if (pitchSlot === undefined || voiceSlot === undefined) return null;
    const random = seededRandom(seed, index + 100);
    const pitch = choose(voice === "bassline" ? BASS_PITCH : LEAD_PITCH, random);
    // One-bar requests also use one-bar pitch cycles.
    const steps = request.development === 0 ? 16 : pitch.steps;
    patch.blocks[pitchSlot] = { ...createBlock(pitchSlot), kind: "modulator", voice: "", steps, pulses: 1, shape: pitch.shape };
    addVoice(voice, choose(rhythmChoices(voice, request), random), voiceSlot);
    if (request.harmony === "keep") {
      for (const key of ["root", "scale", "octave"]) patch.voices[voice].custom[key] = source.voices[voice].custom[key];
      patch.voices[voice].tune = source.voices[voice].tune;
    }
    patch.voices[voice].modulations = [{ source: `${pitchSlot}`, destination: "vOct", amount: pitch.amount }];
  }
  const drums = [...selected].filter((voice) => !SYNTH_VOICE_IDS.has(voice) && !protectedVoices.has(voice));
  // Core parts first; selection order cannot consume their budget accidentally.
  const priority = (voice: VoiceId) => { const index = ["kick", "snare", "clap", "ch"].indexOf(voice); return index < 0 ? 4 : index; };
  drums.sort((a, b) => priority(a) - priority(b));
  for (const voice of drums) {
    const slot = take();
    if (slot === undefined) return null;
    const random = seededRandom(seed, VOICE_DEFS.findIndex((definition) => definition.id === voice));
    addVoice(voice, choose(rhythmChoices(voice, request), random), slot);
  }
  if ((request.profile === "broken" || request.profile === "halftime") && selected.has("kick") && !protectedVoices.has("kick") && request.syncopation > 0) {
    const slot = take();
    if (slot !== undefined) addVoice("kick", { pulses: 1, offset: choose(request.syncopation === 1 ? [6, 10] : [3, 7, 11, 14], seededRandom(seed, 200)) }, slot);
    else constraints.notices.add("The optional kick pickup was omitted to fit the available slots.");
  }
  return patch;
}

function reshape(source: Patch, request: MusicalRequest, constraints: Constraints, locks: BlockRandomizationLocks[], seed: number): Patch {
  const patch = copy(source);
  const eligible = patch.blocks.flatMap((block, slot) => block.voice && constraints.selected.has(block.voice) && !constraints.protectedSlots.has(slot) && !constraints.protectedVoices.has(block.voice) ? [slot] : []);
  const random = seededRandom(seed, 300);
  const budget = Math.max(1, Math.ceil(eligible.length * [0.3, 0.6, 1][request.change]));
  // Fisher–Yates bounds selection and keeps randomness out of sort comparators.
  for (let index = eligible.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [eligible[index], eligible[target]] = [eligible[target], eligible[index]];
  }
  for (const slot of eligible.slice(0, budget)) {
    const block = patch.blocks[slot];
    const choices = rhythmChoices(block.voice as VoiceId, request);
    const recipe = choose(choices, seededRandom(seed, slot));
    if (request.change === 0) {
      recipe.pulses = Math.max(0, Math.min(block.steps, block.pulses + Math.sign(recipe.pulses - block.pulses)));
    }
    const blockLocks = Object.values(locks[slot] ?? {}).some(Boolean) ? locks[slot] : undefined;
    patch.blocks[slot] = applyRhythm(block, recipe, request, blockLocks);
  }
  if (request.reshapeMelody) reshapePitch(patch, request, constraints, locks, seed);
  return patch;
}

function reshapePitch(patch: Patch, request: MusicalRequest, constraints: Constraints, locks: BlockRandomizationLocks[], seed: number) {
  for (const voice of ["bassline", "lead"] as const) {
    if (!constraints.selected.has(voice) || constraints.protectedVoices.has(voice)) continue;
    const route = patch.voices[voice].modulations.find((route) => route.destination === "vOct");
    const slot = route && route.source !== "" ? Number(route.source) : -1;
    const block = patch.blocks[slot];
    const consumers = patch.blocks.some((candidate) => candidate.clk.includes(`${slot}`) || candidate.rst === `${slot}` || candidate.mut === `${slot}` || (candidate.kind === "quantizer" && candidate.quantizerSource === `${slot}`) || candidate.modulations.some((mod) => mod.source === `${slot}`)) || VOICE_DEFS.some(({ id }) => patch.voices[id].modulations.some((mod) => mod.source === `${slot}` && (id !== voice || mod.destination !== "vOct")));
    if (!route || !block || patch.rate !== 4 || block.kind !== "modulator" || !simpleClock(block) || block.series.length || block.shape === "rnd" || consumers || Object.values(locks[slot] ?? {}).some(Boolean)) {
      constraints.notices.add(`${voiceName(voice)} pitch routing was kept; its source is shared, locked, or uses a different configuration.`);
      continue;
    }
    const recipe = choose(voice === "bassline" ? BASS_PITCH : LEAD_PITCH, seededRandom(seed, voice === "bassline" ? 400 : 401));
    patch.blocks[slot] = { ...block, steps: request.development === 0 ? 16 : recipe.steps, pulses: 1, rot: 0, shape: recipe.shape };
    route.amount = recipe.amount;
  }
}

function changedParts(source: Patch, patch: Patch): VoiceId[] {
  const group = (value: Patch) => {
    const groups = new Map<VoiceId, SequencerBlock[]>();
    for (const block of value.blocks) for (const voice of blockVoices(block)) groups.set(voice, [...(groups.get(voice) ?? []), block]);
    return groups;
  };
  const before = group(source);
  const after = group(patch);
  return VOICE_DEFS.flatMap(({ id }) => {
    return same(before.get(id), after.get(id)) && same(source.voices[id], patch.voices[id]) ? [] : [id];
  });
}

export function generateMusicalPatch(source: Patch, rawRequest: MusicalRequest, seed: number, locks = createRandomizationLocks(), avoid?: Patch): GenerationResult {
  const request: MusicalRequest = { ...rawRequest, bpm: Math.max(20, Math.min(300, Math.round(rawRequest.bpm) || source.bpm)), root: Math.max(0, Math.min(11, Math.round(rawRequest.root) || 0)), scale: Math.max(0, Math.min(SCALE_DEFS.length - 1, Math.round(rawRequest.scale) || 0)) };
  if (!request.parts.length) return { error: "Choose at least one part to generate or reshape." };
  const constraints = resolveConstraints(source, request, locks);
  const existingVoices = new Set(source.blocks.flatMap(blockVoices));
  if (request.mode === "reshape") {
    const missing = request.parts.filter((voice) => !existingVoices.has(voice));
    if (missing.length === request.parts.length) return { error: "The selected parts have no existing lanes. Choose Create a new groove to add instruments." };
    if (missing.length) constraints.notices.add(`No existing lanes for ${missing.map(voiceName).join(", ")}. Use Create a new groove to add those instruments.`);
  }
  if (request.parts.every((voice) => constraints.protectedVoices.has(voice))) return { error: "All selected parts are protected. Select another part or release a Keep control or lock." };
  if (request.mode === "new" && constraints.protectedSlots.size && source.rate !== 4) return { error: "Protected parts use a different clock rate. Use Reshape, or unlock those parts before creating a new groove." };
  const candidates: { patch: Patch; score: number; notices: string[] }[] = [];
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidateSeed = (seed + Math.imul(attempt, 7919)) >>> 0;
    const patch = request.mode === "new" ? newGroove(source, request, constraints, candidateSeed) : reshape(source, request, constraints, locks, candidateSeed);
    if (!patch) continue;
    const preserveTiming = request.mode === "new" && constraints.protectedSlots.size > 0;
    if (!preserveTiming) {
      patch.bpm = request.bpm;
      patch.swing = request.swing === "keep" ? source.swing : { straight: 0, light: 16, strong: 32 }[request.swing];
    }
    if (request.harmony === "shared") for (const voice of constraints.melodic) {
      if (constraints.protectedVoices.has(voice)) continue;
      Object.assign(patch.voices[voice].custom, { root: request.root, scale: request.scale });
    }
    const normalized = normalizePatch(patch)!;
    // Never normalize protected user material into a different representation.
    for (const slot of constraints.protectedSlots) normalized.blocks[slot] = patch.blocks[slot];
    for (const voice of constraints.protectedVoices) normalized.voices[voice] = copy(source.voices[voice]);
    if (request.mode === "reshape") {
      normalized.blocks = normalized.blocks.map((block, slot) => {
        if (same(patch.blocks[slot], source.blocks[slot])) return copy(source.blocks[slot]);
        for (const parameter of ROW_PARAMS) if (locks[slot]?.[parameter]) block[parameter] = source.blocks[slot][parameter];
        return block;
      });
    }
    if (hasNewDuplicateHits(normalized, source, request)) continue;
    if (same(source, normalized) || (avoid && same(avoid, normalized))) continue;
    candidates.push({ patch: normalized, score: candidateScore(normalized, source, request), notices: [...constraints.notices] });
  }
  if (!candidates.length) return { error: "No different groove fits these settings and locks. Try a larger change, select more parts, or free some sequencer slots." };
  const random = seededRandom(seed, 999);
  let weight = random() * candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  const selected = candidates.find((candidate) => (weight -= candidate.score) <= 0) ?? candidates[0];
  const candidate: MusicalCandidate = {
    patch: selected.patch, seed: seed >>> 0, version: 1, changedParts: changedParts(source, selected.patch), notices: selected.notices,
    summary: `${PROFILES[request.profile].name} · ${["spacious", "balanced", "busy"][request.density]} · ${["grounded", "some bounce", "adventurous"][request.syncopation]} · ${[1, 2, 4][request.development]}-bar generated phrase · ${selected.patch.bpm} BPM · swing ${selected.patch.swing}%${constraints.melodic.length ? request.harmony === "shared" ? ` · ${NOTE_NAMES[request.root]} ${SCALE_DEFS[request.scale].name}` : " · existing tuning" : ""}`,
  };
  if (request.mode === "reshape") candidate.notices.push("Existing sounds, routing, mutes, and authored rhythm series are retained. The phrase setting applies to eligible single rhythms.");
  if (constraints.protectedVoices.size) candidate.notices.push(`Kept parts: ${[...constraints.protectedVoices].filter((voice) => existingVoices.has(voice)).map(voiceName).join(", ") || "routing sources"}.`);
  return { candidate };
}

function hasNewDuplicateHits(patch: Patch, source: Patch, request: MusicalRequest): boolean {
  const counts = (value: Patch) => {
    const result = new Map<string, number>();
    for (const event of musicalEvents(value)) {
      const key = `${event.voice}:${event.pulse}`;
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  };
  const original = counts(source);
  for (const [key, count] of counts(patch)) {
    // Existing protected layering is allowed, newly doubled hits are not.
    if (count > 1 && count > (request.mode === "reshape" || request.keep.length ? original.get(key) ?? 1 : 1)) return true;
  }
  return false;
}
