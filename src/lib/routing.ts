import { MOD_DESTS } from "./constants";
import { VOICE_MODULATION_TARGETS } from "./modulation";
import type { Patch, SequencerBlock, VoiceId } from "./types";

export interface Connection {
  source: number;
  target: number | VoiceId;
  output: "Trigger" | "Gate" | "LFO" | "CV";
  input: string;
}

export function connectionsFor(input: SequencerBlock[] | Pick<Patch, "blocks" | "voices">): Connection[] {
  const blocks = Array.isArray(input) ? input : input.blocks;
  const connections: Connection[] = [];
  const cvOutput = (source: string) => blocks[Number(source)]?.kind === "quantizer" ? "CV" as const : "LFO" as const;
  blocks.forEach((block, target) => {
    block.clk.filter((source) => source !== "G").forEach((source) => connections.push({ source: Number(source), target, output: "Trigger", input: "Clock" }));
    if (block.rst !== "" && block.rst !== "BAR" && block.rst !== "G") connections.push({ source: Number(block.rst), target, output: "Trigger", input: "Reset" });
    if (block.mut !== "") connections.push({ source: Number(block.mut), target, output: "Gate", input: "Mute" });
    if (block.kind === "quantizer" && block.quantizerSource !== "") connections.push({ source: Number(block.quantizerSource), target, output: cvOutput(block.quantizerSource), input: "Pitch CV" });
    for (const route of block.modulations) {
      if (route.source !== "") connections.push({ source: Number(route.source), target, output: cvOutput(route.source), input: MOD_DESTS.find(([value]) => value === route.destination)?.[1] ?? route.destination });
    }
  });
  if (!Array.isArray(input)) {
    for (const [voiceId, voice] of Object.entries(input.voices) as Array<[VoiceId, Patch["voices"][VoiceId]]>) {
      for (const route of voice.modulations) {
        if (route.source !== "") connections.push({ source: Number(route.source), target: voiceId, output: cvOutput(route.source), input: VOICE_MODULATION_TARGETS.find(([value]) => value === route.destination)?.[1] ?? route.destination });
      }
    }
  }
  return connections;
}

export const isVoiceTarget = (connection: Connection): connection is Connection & { target: VoiceId } => typeof connection.target === "string";
