import { useState } from "react";
import { Check, Clipboard, Download } from "lucide-react";
import { buildLua } from "@/export/lua";
import { buildMidi } from "@/export/midi";
import { buildStrudel } from "@/export/strudel";
import { normalizePatch } from "@/lib/patch";
import type { Patch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patch: Patch;
  onLoad: (patch: Patch) => void;
}

type ExportFormat = "lua" | "midi" | "strudel" | "json";

const formatName: Record<ExportFormat, string> = {
  lua: "Lua data",
  midi: "MIDI file",
  strudel: "Strudel code",
  json: "JSON patch",
};

const description: Record<ExportFormat, string> = {
  lua: "The Lua data table consumed by the Euclid Grid example in Luading.",
  midi: "A multi-track MIDI loop with tempo, GM drum notes, synth notes, rhythm series, chance, gate length, and swing baked in.",
  strudel: "Playable Strudel code with Euclidean rhythms, rhythm series, tempo, swing, chance, voice levels, and drum-machine banks.",
  json: "The whole patch as JSON. Edit or paste another patch here, then load it.",
};

export function ExportDialog({ open, onOpenChange, patch, onLoad }: ExportDialogProps) {
  const [tab, setTab] = useState<ExportFormat>("lua");
  const [text, setText] = useState(() => buildLua(patch));
  const [message, setMessage] = useState("");

  const changeTab = (value: ExportFormat) => {
    setTab(value);
    if (value === "lua") setText(buildLua(patch));
    if (value === "strudel") setText(buildStrudel(patch));
    if (value === "json") setText(JSON.stringify(patch, null, 2));
    setMessage("");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`Copied ${formatName[tab]} to the clipboard.`);
    } catch {
      setMessage("Copy was blocked. Select the text and press Cmd/Ctrl+C.");
    }
  };

  const downloadMidi = () => {
    const bytes = buildMidi(patch);
    const data = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(data).set(bytes);
    const url = URL.createObjectURL(new Blob([data], { type: "audio/midi" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `beatling-${patch.bpm}bpm.mid`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Downloaded MIDI file.");
  };

  const load = () => {
    try {
      const normalized = normalizePatch(JSON.parse(text));
      if (!normalized) throw new Error("no blocks in this patch");
      onLoad(normalized);
      setMessage("Patch loaded.");
    } catch (error) {
      setMessage(`That JSON did not load: ${error instanceof Error ? error.message : "invalid JSON"}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="export-description">
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <DialogTitle className="text-sm font-semibold">Export</DialogTitle>
          <DialogDescription id="export-description" className="min-w-[18rem] flex-1 text-xs text-muted">
            {description[tab]}
          </DialogDescription>
          <Tabs value={tab} onValueChange={(value) => changeTab(value as ExportFormat)}>
            <TabsList>
              <TabsTrigger value="lua">Lua</TabsTrigger>
              <TabsTrigger value="midi">MIDI</TabsTrigger>
              <TabsTrigger value="strudel">Strudel</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "midi"
            ? <Button type="button" variant="outline" onClick={downloadMidi}><Download className="size-3.5" />Download .mid</Button>
            : <Button type="button" variant="outline" onClick={copy}><Clipboard className="size-3.5" />Copy</Button>}
          {tab === "json" && <Button type="button" variant="outline" onClick={load}>Load JSON</Button>}
        </div>
        {tab === "midi"
          ? <div className="flex min-h-[260px] flex-1 items-center justify-center rounded-sm border border-rule bg-paper p-8 text-center text-sm text-muted">MIDI is a binary format. Download the file and drop it into your DAW or hardware sequencer.</div>
          : <textarea
              className="min-h-[260px] flex-1 resize-y rounded-sm border border-rule bg-paper p-3 font-mono text-[11px] leading-relaxed focus:border-signal focus:outline-none"
              value={text}
              readOnly={tab !== "json"}
              spellCheck={false}
              aria-label="Export text"
              onChange={(event) => setText(event.target.value)}
            />}
        <div className="min-h-4 text-xs text-signal">{message && <span className="inline-flex items-center gap-1"><Check className="size-3" />{message}</span>}</div>
      </DialogContent>
    </Dialog>
  );
}
