import { MOD_DESTS } from "./constants";
import type { SequencerBlock } from "./types";

export interface Connection {
  source: number;
  target: number;
  output: "Trigger" | "Gate" | "LFO";
  input: string;
}

export function connectionsFor(blocks: SequencerBlock[]): Connection[] {
  const connections: Connection[] = [];
  blocks.forEach((block, target) => {
    block.clk.filter((source) => source !== "G").forEach((source) => connections.push({ source: Number(source), target, output: "Trigger", input: "Clock" }));
    if (block.rst !== "" && block.rst !== "BAR" && block.rst !== "G") connections.push({ source: Number(block.rst), target, output: "Trigger", input: "Reset" });
    if (block.mut !== "") connections.push({ source: Number(block.mut), target, output: "Gate", input: "Mute" });
    for (const route of block.modulations) {
      if (route.source !== "") connections.push({ source: Number(route.source), target, output: "LFO", input: MOD_DESTS.find(([value]) => value === route.destination)?.[1] ?? route.destination });
    }
  });
  return connections;
}
