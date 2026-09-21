import { BLOCK_COUNT, type LfoShape, type ModDestination, type Patch } from "@/lib/types";
import { blockName, padBlock, voiceTag } from "@/lib/constants";
import { rhythmsFor } from "@/lib/rhythm-series";

const SHAPE_NUMBER: Record<LfoShape, number> = { ramp: 1, tri: 2, sqr: 3, rnd: 4 };
const DESTINATION_NUMBER: Record<ModDestination, number> = {
  "": 0,
  pulses: 1,
  rot: 2,
  prob: 3,
  div: 4,
  tune: 0,
  decay: 0,
  level: 0,
};

const sourceNumber = (value: string) => {
  if (value === "") return -9;
  if (value === "G") return 0;
  if (value === "BAR") return -1;
  return Number(value) + 1;
};

const luaString = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export function buildLua(patch: Patch): string {
  const usedTriggers = new Set<number>();
  const usedLfos = new Set<number>();
  patch.blocks.forEach((block) => {
    block.clk.forEach((source) => source !== "G" && usedTriggers.add(Number(source)));
    if (!["", "G", "BAR"].includes(block.rst)) usedTriggers.add(Number(block.rst));
    if (block.mut !== "") usedTriggers.add(Number(block.mut));
    block.modulations.forEach((route) => {
      if (route.source !== "" && route.amount !== 0) usedLfos.add(Number(route.source));
    });
  });

  const outputs: Array<{ type: "stepped" | "linear"; name: string }> = [];
  const outputIndexes = new Array(BLOCK_COUNT).fill(0) as number[];
  const lfoIndexes = new Array(BLOCK_COUNT).fill(0) as number[];
  patch.blocks.forEach((block, index) => {
    const voiceBlock = block.kind === "voice" && block.voice;
    if (outputs.length >= 28 || (!voiceBlock && !usedTriggers.has(index))) return;
    outputs.push({ type: "stepped", name: `${padBlock(index)} ${voiceBlock ? blockName(block) : "trig"}` });
    outputIndexes[index] = outputs.length;
  });
  patch.blocks.forEach((_block, index) => {
    if (outputs.length >= 28 || !usedLfos.has(index)) return;
    outputs.push({ type: "linear", name: `${padBlock(index)} LFO` });
    lfoIndexes[index] = outputs.length;
  });
  if (!outputs.length) {
    outputs.push({ type: "stepped", name: "01 trig" });
    outputIndexes[0] = 1;
  }

  const rows = patch.blocks.map((block, index) => {
    const voiceBlock = block.kind === "voice" && block.voice;
    const voiceTargets = block.modulations.filter((route) => ["tune", "decay", "level"].includes(route.destination));
    const browserNotes = [
      voiceTargets.length ? `voice mod (${voiceTargets.map((route) => route.destination).join(", ")})` : "",
      block.kind === "bernoulli" ? `Bernoulli voices ${block.branchVoices.join("/")}` : "",
    ].filter(Boolean);
    const browserOnly = browserNotes.length ? `  -- browser ${browserNotes.join("; ")} not exported` : "";
    const mods = block.modulations
      .filter((route) => route.source !== "" && DESTINATION_NUMBER[route.destination] > 0)
      .map((route) => `{ src=${Number(route.source) + 1}, dst=${DESTINATION_NUMBER[route.destination]}, amt=${route.amount.toFixed(2)} }`)
      .join(", ");
    const series = rhythmsFor(block)
      .map((rhythm) => `{ steps=${rhythm.steps}, pulses=${rhythm.pulses}, rot=${rhythm.rot}, repeats=${rhythm.repeats} }`)
      .join(", ");
    return `\t\t{ steps=${block.steps}, pulses=${block.pulses}, rot=${block.rot}, series={${series}}, div=${block.div}, prob=${block.prob}, gate=${block.gate}, clk={${block.clk.map(sourceNumber).join(", ")}}, rst=${sourceNumber(block.rst)}, mut=${block.mut === "" ? 0 : Number(block.mut) + 1}, mn=${block.mute}, shape=${SHAPE_NUMBER[block.shape]}, euclidean=${!voiceBlock}, mods={${mods}}, out=${outputIndexes[index]}, lout=${lfoIndexes[index]}, tag=${luaString(voiceBlock ? voiceTag(block.voice) : "--")} },${browserOnly}`;
  });
  const voiceRoutingNotes = Object.entries(patch.voices).flatMap(([id, voice]) => voice.modulations
    .filter((route) => route.source !== "")
    .map((route) => `-- browser voice routing: ${id} ${route.destination} <- block ${Number(route.source) + 1} (${Math.round(route.amount * 100)}%) not exported`));
  const outputRows = outputs.map((output) => `\t\t{ type=${luaString(output.type)}, name=${luaString(output.name)} },`);

  return `-- Beatling data for the Euclid Grid example in Luading
return {
\tversion = 1,
\tbpm = ${patch.bpm},
\trate = ${patch.rate},
\tbar = ${patch.rate * 4},
\toutputs = {
${outputRows.join("\n")}
\t},
\tblocks = {
${rows.join("\n")}
\t},
}${voiceRoutingNotes.length ? `\n\n${voiceRoutingNotes.join("\n")}` : ""}
`;
}
