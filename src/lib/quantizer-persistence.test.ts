import { afterEach, expect, it } from "vitest";
import { createEmptyPatch, loadStoredPatch, normalizePatch, savePatch } from "./patch";
import { createArrangement, loadStoredArrangement, saveArrangement, variationHasChanges } from "./variations";
import { connectionsFor } from "./routing";
import { cablePort, cableSignal } from "./cables";

afterEach(() => localStorage.clear());

it("migrates v28 with voice quantizers enabled and round-trips quantizer routes and bypass", () => {
  const old = createEmptyPatch();
  delete old.voices.lead.custom.quantizer;
  delete old.voices.bassline.custom.quantizer;
  localStorage.setItem("egs.patch.v28", JSON.stringify({ ...old, format: "euclid-grid.v28" }));
  localStorage.setItem("egs.arrangement.v28", JSON.stringify({ ...createArrangement(old), format: "euclid-grid.arrangement.v28" }));
  const patch = loadStoredPatch()!;
  const arrangement = loadStoredArrangement(patch);
  expect(patch.voices.lead.custom.quantizer).toBe(1);
  expect(arrangement.variations[0].patch.voices.bassline.custom.quantizer).toBe(1);
  Object.assign(patch.blocks[1], { kind: "quantizer", voice: "", steps: 12, pulses: 7, quantizerSource: "12" });
  patch.voices.lead.custom.quantizer = 0;
  patch.voices.lead.modulations = [{ source: "1", destination: "vOct", amount: 1 }];
  savePatch(patch);
  saveArrangement(createArrangement(patch));
  expect(loadStoredPatch()).toEqual(patch);
  expect(loadStoredArrangement(old).variations[0].patch).toEqual(patch);
  expect(variationHasChanges(createArrangement(patch).variations[0], createArrangement(old).variations[0])).toBe(true);
  const connections = connectionsFor(patch);
  expect(connections).toContainEqual({ source: 12, target: 1, output: "LFO", input: "Pitch CV" });
  const output = connections.find((connection) => connection.target === "lead")!;
  expect(output).toEqual({ source: 1, target: "lead", output: "CV", input: "V/Oct" });
  expect(cablePort(output, "source")).toBe("out-CV");
  expect(cablePort(output, "target")).toBe("in-Mod-V/Oct");
  expect(cableSignal(output).input).toBe("Mod");
});

it.each(["0", "16", "-1", "NaN", {}, null])("rejects invalid or self pitch sources: %j", (source) => {
  const patch = createEmptyPatch();
  Object.assign(patch.blocks[0], { kind: "quantizer", quantizerSource: source });
  expect(normalizePatch(patch)!.blocks[0]).toMatchObject({ kind: "quantizer", voice: "", quantizerSource: "" });
});
