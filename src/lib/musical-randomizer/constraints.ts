import { SYNTH_VOICE_IDS, VOICE_DEFS } from "@/lib/constants";
import type { BlockRandomizationLocks, Patch, SequencerBlock, VoiceId } from "@/lib/types";
import type { MusicalRequest } from "./types";

export const blockVoices = (block: SequencerBlock): VoiceId[] => block.kind === "bernoulli" ? block.branchVoices : block.voice ? [block.voice] : [];

export function simpleClock(block: SequencerBlock): boolean {
  return block.clk.length === 1 && block.clk[0] === "G" && block.rst === "" && block.mut === "" && block.div === 1 && block.modulations.length === 0;
}

export function resolveConstraints(patch: Patch, request: MusicalRequest, locks: BlockRandomizationLocks[]) {
  const protectedSlots = new Set<number>();
  const protectedVoices = new Set<VoiceId>(request.keep);
  const selected = new Set(request.parts);
  const notices = new Set<string>();
  if (request.mode === "reshape") {
    for (const { id } of VOICE_DEFS) if (!selected.has(id)) protectedVoices.add(id);
  }
  patch.blocks.forEach((block, index) => {
    const locked = Object.values(locks[index] ?? {}).some(Boolean);
    const fullyLocked = Object.values(locks[index] ?? {}).length > 0 && Object.values(locks[index]).every(Boolean);
    if (fullyLocked || (request.mode === "new" && locked)) {
      protectedSlots.add(index);
      notices.add("Locked slots and their dependencies were kept intact.");
    }
    if (request.mode === "reshape" && (block.kind !== "voice" || !simpleClock(block) || patch.rate !== 4)) {
      protectedSlots.add(index);
      if (blockVoices(block).length) notices.add("Parts with routed clocks, modulation, or unsupported timing were kept intact.");
    }
  });
  if (request.mode === "reshape") {
    for (const block of patch.blocks) for (const route of block.modulations) if (route.source !== "") protectedSlots.add(Number(route.source));
    for (const voice of Object.values(patch.voices)) for (const route of voice.modulations) if (route.source !== "") protectedSlots.add(Number(route.source));
  }
  // Preserve a whole shared voice and all its contributing slots when one of
  // its slots is protected. This avoids changing a kept part through another lane.
  let changed = true;
  while (changed) {
    const size = protectedSlots.size + protectedVoices.size;
    patch.blocks.forEach((block, index) => {
      if (blockVoices(block).some((voice) => protectedVoices.has(voice))) protectedSlots.add(index);
      if (!protectedSlots.has(index)) return;
      for (const voice of blockVoices(block)) protectedVoices.add(voice);
      const sources = [...block.clk, block.rst, block.mut, ...block.modulations.map((route) => route.source)];
      for (const voice of blockVoices(block)) sources.push(...patch.voices[voice].modulations.map((route) => route.source));
      for (const source of sources) if (/^\d+$/.test(source) && Number(source) < patch.blocks.length) protectedSlots.add(Number(source));
    });
    changed = size !== protectedSlots.size + protectedVoices.size;
  }
  if (request.mode === "new" && protectedSlots.size) {
    notices.add("Existing timing and effects were retained to preserve protected parts.");
  }
  const melodic = [...selected].filter((voice) => SYNTH_VOICE_IDS.has(voice));
  return { protectedSlots, protectedVoices, selected, notices, melodic };
}
