import { useState } from "react";
import { Download, FolderSync, Save as SaveIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalPresets } from "@/hooks/use-local-presets";
import { createDemoPatch } from "@/lib/patch";
import { createPresetArrangement, PRESET_GROUPS } from "@/lib/presets";
import { createArrangement } from "@/lib/variations";
import type { Arrangement } from "@/lib/types";

interface SessionPresetControlsProps {
  arrangement: Arrangement;
  onApply: (arrangement: Arrangement) => void;
  onExport: () => void;
}

export function SessionPresetControls({ arrangement, onApply, onExport }: SessionPresetControlsProps) {
  const patch = arrangement.variations[arrangement.activeIndex].patch;
  const [factoryPresetId, setFactoryPresetId] = useState("");
  const localPresets = useLocalPresets(patch);

  const loadLocalPreset = async (value: string) => {
    const next = await localPresets.loadPreset(value);
    if (!next) return;
    setFactoryPresetId("");
    onApply(next);
  };

  const openPresetFile = async () => {
    const next = await localPresets.openPreset();
    if (!next) return;
    setFactoryPresetId("");
    onApply(next);
  };

  return (
    <div className="session-actions">
      <select
        className="preset-select"
        aria-label="Drum pattern preset"
        value={localPresets.selectedValue || factoryPresetId}
        onChange={(event) => {
          const nextPreset = event.target.value;
          if (nextPreset.startsWith("local:")) {
            void loadLocalPreset(nextPreset);
            return;
          }
          localPresets.clearSelection();
          setFactoryPresetId(nextPreset);
          onApply(createPresetArrangement(nextPreset, patch.vol));
        }}
      >
        <option value="" disabled>Presets</option>
        {PRESET_GROUPS.map((group) => <optgroup key={group.category} label={group.category}>{group.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>)}
        {localPresets.files.length > 0 && <optgroup label={`Local · ${localPresets.directoryName}`}>{localPresets.files.map((file) => <option key={file.value} value={file.value}>{file.name.replace(/\.json$/i, "")}</option>)}</optgroup>}
      </select>
      <Button variant="outline" onClick={() => { localPresets.clearSelection(); setFactoryPresetId(""); onApply(createArrangement(createDemoPatch(patch.vol))); }}>Load demo</Button>
      <Button size="icon" variant="outline" aria-label="Save" disabled={!localPresets.supported} title={localPresets.supported ? "Save the arrangement to a JSON preset file" : "File System Access API is not supported by this browser"} onClick={() => void localPresets.savePreset(arrangement)}><SaveIcon size={13} /></Button>
      <Button size="icon" variant="outline" aria-label="Load" disabled={!localPresets.supported} title={localPresets.supported ? "Load a Beatling JSON preset file" : "File System Access API is not supported by this browser"} onClick={() => void openPresetFile()}><Upload size={13} /></Button>
      <Button size="icon" variant="outline" aria-label={localPresets.directoryName ? "Resync folder" : "Sync folder"} disabled={!localPresets.supported} title={localPresets.directoryName ? `Sync presets from ${localPresets.directoryName}` : "Choose a folder to sync presets from"} onClick={() => void localPresets.syncDirectory()}><FolderSync size={13} /></Button>
      <Button variant="outline" onClick={onExport}><Download size={13} />Export</Button>
      <span className="file-status" role="status" aria-live="polite" title={localPresets.message}>{localPresets.message}</span>
    </div>
  );
}
