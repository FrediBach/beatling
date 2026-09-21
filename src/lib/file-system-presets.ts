import { normalizePatch } from "@/lib/patch";
import { createArrangement, normalizeArrangement } from "@/lib/variations";
import type { Arrangement, Patch } from "@/lib/types";

export const PRESET_FILE_TYPES: FilePickerAcceptType[] = [{
  description: "Beatling preset",
  accept: { "application/json": [".json"] },
}];

export interface LocalPresetFile {
  handle: FileSystemFileHandle;
  name: string;
  value: string;
}

export function parsePresetText(text: string, fallback: Patch): Arrangement {
  const value: unknown = JSON.parse(text);
  if (value && typeof value === "object" && Array.isArray((value as Partial<Arrangement>).variations)) {
    const input = value as Partial<Arrangement>;
    if (input.variations?.some((variation) => normalizePatch(variation?.patch))) return normalizeArrangement(value, fallback);
  }
  const patch = normalizePatch(value);
  if (patch) return createArrangement(patch);
  throw new Error("the file is not a Beatling patch or arrangement");
}

export async function readPresetFile(handle: FileSystemFileHandle, fallback: Patch): Promise<Arrangement> {
  const file = await handle.getFile();
  return parsePresetText(await file.text(), fallback);
}

export async function listPresetFiles(directory: FileSystemDirectoryHandle, fallback: Patch): Promise<LocalPresetFile[]> {
  const files: LocalPresetFile[] = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== "file" || !name.toLowerCase().endsWith(".json")) continue;
    try {
      await readPresetFile(handle, fallback);
      files.push({ handle, name, value: `local:${encodeURIComponent(name)}` });
    } catch {
      // Other JSON files in a synced directory are not presets.
    }
  }
  return files.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
}

export async function writePresetFile(handle: FileSystemFileHandle, arrangement: Arrangement): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(arrangement, null, 2)}\n`);
  await writable.close();
}
