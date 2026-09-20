import { describe, expect, it } from "vitest";
import { createDemoPatch, createEmptyPatch } from "./patch";
import { connectionsFor } from "./routing";

describe("signal routing", () => {
  it("traces trigger, gate and LFO connections without treating the global clock as a block", () => {
    const connections = connectionsFor(createDemoPatch().blocks);
    expect(connections).toHaveLength(6);
    expect(connections).toContainEqual({ source: 0, target: 10, output: "Trigger", input: "Clock" });
    expect(connections).toContainEqual({ source: 15, target: 4, output: "Gate", input: "Mute" });
    expect(connections).toContainEqual({ source: 12, target: 2, output: "LFO", input: "chance" });
    expect(connectionsFor(createEmptyPatch().blocks)).toEqual([]);
  });
});
