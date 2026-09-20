import type { Connection } from "./routing";

export const CABLE_SIGNALS = [
  { input: "Clock", color: "#d99530" },
  { input: "Reset", color: "#e56d57" },
  { input: "Mute", color: "#4cafab" },
  { input: "Mod", color: "#a78ae0" },
] as const;

export function cableSignal(connection: Connection) {
  return CABLE_SIGNALS[connection.output === "LFO" ? 3 : connection.input === "Mute" ? 2 : connection.input === "Reset" ? 1 : 0];
}

export function cablePort(connection: Connection, end: "source" | "target") {
  return end === "source" ? `out-${connection.output}` : `in-${cableSignal(connection).input}`;
}
