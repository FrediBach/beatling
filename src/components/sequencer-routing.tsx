import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { cablePort, cableSignal, CABLE_SIGNALS } from "@/lib/cables";
import { padBlock, voiceName } from "@/lib/constants";
import { connectionsFor, type Connection } from "@/lib/routing";
import type { SequencerBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SequencerRoutingProps {
  index: number;
  block: SequencerBlock;
  blocks: SequencerBlock[];
  patchOpen: boolean;
  changedFields: ReadonlySet<keyof SequencerBlock>;
  onPatchOpen: (index: number | null) => void;
  connections?: Connection[];
}

const ROUTING_FIELDS: Array<keyof SequencerBlock> = ["clk", "rst", "mut", "gate", "modulations", "shape", "quantizerSource"];

export function SequencerRouting({ index, block, blocks, patchOpen, changedFields, onPatchOpen, connections = connectionsFor(blocks) }: SequencerRoutingProps) {
  const incoming = connections.filter((connection) => connection.target === index);
  const outgoing = connections.filter((connection) => connection.source === index);
  return <div className={cn("routing-strip", ROUTING_FIELDS.some((field) => changedFields.has(field)) && "variation-changed")}>
    {incoming.length > 0 ? <RoutingPorts ownerLabel={`block ${padBlock(index)}`} connections={incoming} end="target" onOpen={() => onPatchOpen(index)} /> : <span className="route-summary">{block.clk.includes("G") ? "Global clock" : "No clock"}</span>}
    {block.kind === "bernoulli" && <span className="route-summary" title={`Euclidean hits route to A at ${block.prob}% probability, or B otherwise`}>A {voiceName(block.branchVoices[0])} / B {voiceName(block.branchVoices[1])}</span>}
    {outgoing.length > 0 && <RoutingPorts ownerLabel={`block ${padBlock(index)}`} connections={outgoing} end="source" onOpen={() => onPatchOpen(index)} />}
    <button className="patch-action" aria-label={`Patch block ${padBlock(index)}`} aria-expanded={patchOpen} onClick={() => onPatchOpen(patchOpen ? null : index)}>
      Patch <ArrowUpRight size={11} />
    </button>
  </div>;
}

export function RoutingPorts({ ownerLabel, connections, end, onOpen }: { ownerLabel: string; connections: Connection[]; end: "source" | "target"; onOpen: () => void }) {
  const groups = new Map<string, Connection[]>();
  for (const connection of connections) {
    const port = cablePort(connection, end);
    const group = groups.get(port) ?? [];
    group.push(connection);
    groups.set(port, group);
  }
  const input = end === "target";
  const label = `${input ? "Inputs to" : "Outputs from"} ${ownerLabel}: ${connections.length} ${connections.length === 1 ? "connection" : "connections"}`;
  const details = connections.map(describeConnection).join("\n");
  return <button type="button" className="routing-ports" title={`${label}\n${details}\nOpen patch settings`} aria-label={`${label}. ${details}. Open patch settings.`} onClick={onOpen}>
    {input ? <ArrowDown size={10} aria-hidden="true" /> : <ArrowUpRight size={10} aria-hidden="true" />}
    <span>{connections.length}</span>
    <span className="routing-sockets" aria-hidden="true">{[...groups].map(([port, routes]) => {
      const first = routes[0];
      const color = input ? cableSignal(first).color : CABLE_SIGNALS[(first.output === "LFO" || first.output === "CV") ? 3 : first.output === "Gate" ? 2 : 0].color;
      return <i key={port} data-cable-port={port} style={{ "--port-color": color } as CSSProperties} title={routes.map(describeConnection).join("\n")} />;
    })}</span>
  </button>;
}

function describeConnection(route: Connection) {
  return `Block ${padBlock(route.source)} ${route.output} → ${typeof route.target === "string" ? `voice ${voiceName(route.target)}` : `block ${padBlock(route.target)}`} ${route.input}`;
}
