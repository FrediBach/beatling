import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { cablePort, cableSignal, CABLE_SIGNALS } from "@/lib/cables";
import { padBlock } from "@/lib/constants";
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
}

const ROUTING_FIELDS: Array<keyof SequencerBlock> = ["clk", "rst", "mut", "gate", "modulations", "shape"];

export function SequencerRouting({ index, block, blocks, patchOpen, changedFields, onPatchOpen }: SequencerRoutingProps) {
  const connections = connectionsFor(blocks);
  const incoming = connections.filter((connection) => connection.target === index);
  const outgoing = connections.filter((connection) => connection.source === index);
  const sources = [...new Set(incoming.map((connection) => padBlock(connection.source)))];
  return <>
    {(incoming.length > 0 || outgoing.length > 0) && <div className="connection-ports" aria-label={`Connections for block ${padBlock(index)}`}>
      <PortBank connections={incoming} end="target" onOpen={() => onPatchOpen(index)} />
      <PortBank connections={outgoing} end="source" onOpen={() => onPatchOpen(index)} />
    </div>}
    <button className={cn("routing-strip", ROUTING_FIELDS.some((field) => changedFields.has(field)) && "variation-changed")} aria-label={`Patch block ${padBlock(index)}`} aria-expanded={patchOpen} onClick={() => onPatchOpen(patchOpen ? null : index)}>
      <span className={cn("jack", incoming.length > 0 && "connected")} />
      <span className="route-summary">{sources.length ? <><ArrowDown size={10} /> {sources.join(" · ")}</> : block.clk.includes("G") ? "Global clock" : "No clock"}</span>
      {outgoing.length > 0 && <span className="route-out"><ArrowUpRight size={10} />{outgoing.length}</span>}
      <span className="patch-action">Patch <ArrowUpRight size={11} /></span>
    </button>
  </>;
}

function PortBank({ connections, end, onOpen }: { connections: Connection[]; end: "source" | "target"; onOpen: () => void }) {
  const groups = new Map<string, Connection[]>();
  for (const connection of connections) {
    const port = cablePort(connection, end);
    const group = groups.get(port) ?? [];
    group.push(connection);
    groups.set(port, group);
  }
  const input = end === "target";
  return <div className={cn("port-bank", input ? "port-inputs" : "port-outputs")}>
    {groups.size > 0 && <span className="port-direction">{input ? "In" : "Out"}</span>}
    {[...groups].map(([port, routes]) => {
      const first = routes[0];
      const label = input ? first.input : first.output;
      const peers = [...new Set(routes.map((route) => padBlock(input ? route.source : route.target)))].join(" · ");
      const description = routes.map((route) => `Block ${padBlock(route.source)} ${route.output} → block ${padBlock(route.target)} ${route.input}`).join("; ");
      const color = input ? cableSignal(first).color : CABLE_SIGNALS[first.output === "LFO" ? 3 : first.output === "Gate" ? 2 : 0].color;
      return <button key={port} type="button" className="connection-port" style={{ "--port-color": color } as CSSProperties} title={`${description}. Open patch settings.`} aria-label={`${description}. Open patch settings.`} onClick={onOpen}>
        <i data-cable-port={port} aria-hidden="true" />
        <span className="port-label">{label}</span>
        <ArrowRight className="port-arrow" size={10} aria-hidden="true" />
        <span className="port-peers">{peers}</span>
      </button>;
    })}
  </div>;
}
