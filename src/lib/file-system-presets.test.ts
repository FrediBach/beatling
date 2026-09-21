import { describe, expect, it, vi } from "vitest";
import { listPresetFiles, parsePresetText, writePresetFile } from "@/lib/file-system-presets";
import { createDemoPatch } from "@/lib/patch";
import { createArrangement } from "@/lib/variations";

function fileHandle(name: string, contents: string, write = vi.fn(), close = vi.fn()): FileSystemFileHandle {
  return {
    kind: "file",
    name,
    getFile: async () => ({ text: async () => contents }) as File,
    createWritable: async () => ({ write, close }) as unknown as FileSystemWritableFileStream,
  } as FileSystemFileHandle;
}

describe("file system presets", () => {
  it("loads both full arrangements and legacy single-patch files", () => {
    const patch = { ...createDemoPatch(), bpm: 137 };
    const arrangement = { ...createArrangement(patch), songMode: true };

    expect(parsePresetText(JSON.stringify(arrangement), createDemoPatch()).songMode).toBe(true);
    expect(parsePresetText(JSON.stringify(patch), createDemoPatch()).variations[0].patch.bpm).toBe(137);
    expect(() => parsePresetText('{"variations":[{"patch":"bad"}]}', createDemoPatch())).toThrow(/not a Beatling/);
  });

  it("lists only valid JSON presets from a directory and sorts their names", async () => {
    const patch = createDemoPatch();
    const handles = [
      fileHandle("Beat 10.json", JSON.stringify(patch)),
      fileHandle("notes.json", "{}"),
      fileHandle("Beat 2.json", JSON.stringify(patch)),
      fileHandle("readme.txt", JSON.stringify(patch)),
    ];
    const directory = {
      kind: "directory",
      name: "My beats",
      async *entries() {
        for (const handle of handles) yield [handle.name, handle] as [string, FileSystemFileHandle];
      },
    } as FileSystemDirectoryHandle;

    const files = await listPresetFiles(directory, patch);
    expect(files.map(({ name }) => name)).toEqual(["Beat 2.json", "Beat 10.json"]);
  });

  it("writes a formatted arrangement and closes the writable stream", async () => {
    const write = vi.fn();
    const close = vi.fn();
    const arrangement = createArrangement(createDemoPatch());

    await writePresetFile(fileHandle("preset.json", "", write, close), arrangement);

    expect(write).toHaveBeenCalledWith(expect.stringContaining('"format": "euclid-grid.arrangement.v9"'));
    expect(close).toHaveBeenCalledOnce();
  });
});
