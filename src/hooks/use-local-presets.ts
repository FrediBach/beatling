import { useCallback, useEffect, useRef, useState } from "react";
import { listPresetFiles, PRESET_FILE_TYPES, readPresetFile, writePresetFile, type LocalPresetFile } from "@/lib/file-system-presets";
import type { Arrangement, Patch } from "@/lib/types";

const DATABASE_NAME = "beatling-file-system";
const STORE_NAME = "handles";
const DIRECTORY_KEY = "preset-directory";

type PermissionState = "denied" | "granted" | "prompt";
type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?(options?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(options?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
};

async function hasPermission(handle: FileSystemHandle, mode: "read" | "readwrite", request = false): Promise<boolean> {
  const capable = handle as PermissionCapableHandle;
  const check = request ? capable.requestPermission : capable.queryPermission;
  return check ? await check.call(capable, { mode }) === "granted" : true;
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function restoreDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!("indexedDB" in window)) return null;
  try {
    const database = await openHandleDatabase();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(DIRECTORY_KEY);
      request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return handle;
  } catch {
    return null;
  }
}

async function rememberDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!("indexedDB" in window)) return;
  try {
    const database = await openHandleDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    database.close();
  } catch {
    // The directory remains connected for this session when handle storage fails.
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useLocalPresets(fallback: Patch) {
  const supported = typeof window.showDirectoryPicker === "function"
    && typeof window.showOpenFilePicker === "function"
    && typeof window.showSaveFilePicker === "function";
  const fallbackRef = useRef(fallback);
  const directoryRef = useRef<FileSystemDirectoryHandle | null>(null);
  const activeFileRef = useRef<FileSystemFileHandle | null>(null);
  const [directoryName, setDirectoryName] = useState("");
  const [files, setFiles] = useState<LocalPresetFile[]>([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  const refreshDirectory = useCallback(async (directory = directoryRef.current) => {
    if (!directory) return [];
    try {
      const nextFiles = await listPresetFiles(directory, fallbackRef.current);
      setFiles(nextFiles);
      setMessage(`${nextFiles.length} ${nextFiles.length === 1 ? "preset" : "presets"} synced from ${directory.name}.`);
      return nextFiles;
    } catch (error) {
      setFiles([]);
      setMessage(`Could not read ${directory.name}: ${error instanceof Error ? error.message : "access failed"}.`);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    void restoreDirectoryHandle().then(async (directory) => {
      if (!active || !directory) return;
      directoryRef.current = directory;
      setDirectoryName(directory.name);
      const permitted = await hasPermission(directory, "read");
      if (active && permitted) await refreshDirectory(directory);
    });
    return () => { active = false; };
  }, [refreshDirectory, supported]);

  useEffect(() => {
    if (!supported) return;
    const refreshOnFocus = () => { if (!document.hidden) void refreshDirectory(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refreshDirectory, supported]);

  const syncDirectory = useCallback(async () => {
    if (!supported) return;
    try {
      const directory = await window.showDirectoryPicker({ id: "beatling-presets", mode: "readwrite" });
      directoryRef.current = directory;
      activeFileRef.current = null;
      setDirectoryName(directory.name);
      setSelectedValue("");
      await rememberDirectoryHandle(directory);
      await refreshDirectory(directory);
    } catch (error) {
      if (!isAbortError(error)) setMessage(`Could not sync that folder: ${error instanceof Error ? error.message : "access failed"}.`);
    }
  }, [refreshDirectory, supported]);

  const loadPreset = useCallback(async (value: string): Promise<Arrangement | null> => {
    const preset = files.find((candidate) => candidate.value === value);
    if (!preset) return null;
    try {
      const arrangement = await readPresetFile(preset.handle, fallbackRef.current);
      activeFileRef.current = preset.handle;
      setSelectedValue(value);
      setMessage(`${preset.name} loaded.`);
      return arrangement;
    } catch (error) {
      setMessage(`Could not load ${preset.name}: ${error instanceof Error ? error.message : "invalid preset"}.`);
      await refreshDirectory();
      return null;
    }
  }, [files, refreshDirectory]);

  const openPreset = useCallback(async (): Promise<Arrangement | null> => {
    if (!supported) return null;
    try {
      const [handle] = await window.showOpenFilePicker({
        id: "beatling-preset",
        startIn: directoryRef.current ?? "documents",
        types: PRESET_FILE_TYPES,
        excludeAcceptAllOption: true,
      });
      if (!handle) return null;
      const arrangement = await readPresetFile(handle, fallbackRef.current);
      activeFileRef.current = handle;
      const directory = directoryRef.current;
      const path = directory ? await directory.resolve(handle) : null;
      const local = path?.length === 1 ? files.find((candidate) => candidate.name === path[0]) : undefined;
      setSelectedValue(local?.value ?? "");
      setMessage(`${handle.name} loaded.`);
      return arrangement;
    } catch (error) {
      if (!isAbortError(error)) setMessage(`Could not load that file: ${error instanceof Error ? error.message : "invalid preset"}.`);
      return null;
    }
  }, [files, supported]);

  const savePreset = useCallback(async (arrangement: Arrangement): Promise<void> => {
    if (!supported) return;
    try {
      const activeFile = activeFileRef.current;
      if (activeFile && !await hasPermission(activeFile, "readwrite", true)) throw new Error("write access was not granted");
      const handle = activeFile ?? await window.showSaveFilePicker({
        id: "beatling-preset",
        startIn: directoryRef.current ?? "documents",
        suggestedName: "beatling-preset.json",
        types: PRESET_FILE_TYPES,
        excludeAcceptAllOption: true,
      });
      await writePresetFile(handle, arrangement);
      activeFileRef.current = handle;
      setMessage(`${handle.name} saved.`);
      const nextFiles = await refreshDirectory();
      const directory = directoryRef.current;
      const path = directory ? await directory.resolve(handle) : null;
      const local = path?.length === 1 ? nextFiles.find((candidate) => candidate.name === path[0]) : undefined;
      if (local) setSelectedValue(local.value);
    } catch (error) {
      if (!isAbortError(error)) setMessage(`Could not save that file: ${error instanceof Error ? error.message : "write failed"}.`);
    }
  }, [refreshDirectory, supported]);

  const clearSelection = useCallback(() => {
    activeFileRef.current = null;
    setSelectedValue("");
  }, []);

  return {
    clearSelection,
    directoryName,
    files,
    loadPreset,
    message,
    openPreset,
    refreshDirectory,
    savePreset,
    selectedValue,
    supported,
    syncDirectory,
  };
}
