import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { buildLua } from "@/export/lua";
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

export function ExportDialog({ open, onOpenChange, patch, onLoad }: ExportDialogProps) {
  const [tab, setTab] = useState<"lua" | "json">("lua");
  const [text, setText] = useState(() => buildLua(patch));
  const [message, setMessage] = useState("");

  const changeTab = (value: "lua" | "json") => {
    setTab(value);
    setText(value === "lua" ? buildLua(patch) : JSON.stringify(patch, null, 2));
    setMessage("");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`Copied ${tab === "lua" ? "Lua script" : "JSON patch"} to the clipboard.`);
    } catch {
      setMessage("Copy was blocked. Select the text and press Cmd/Ctrl+C.");
    }
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
            {tab === "lua"
              ? "A Disting NT Lua script: input 1 is clock, input 2 is reset, with trigger and active LFO outputs."
              : "The whole patch as JSON. Edit or paste another patch here, then load it."}
          </DialogDescription>
          <Tabs value={tab} onValueChange={(value) => changeTab(value as "lua" | "json")}>
            <TabsList>
              <TabsTrigger value="lua">Lua</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button type="button" variant="outline" onClick={copy}><Clipboard className="size-3.5" />Copy</Button>
          {tab === "json" && <Button type="button" variant="outline" onClick={load}>Load JSON</Button>}
        </div>
        <textarea
          className="min-h-[260px] flex-1 resize-y rounded-sm border border-rule bg-paper p-3 font-mono text-[11px] leading-relaxed focus:border-signal focus:outline-none"
          value={text}
          readOnly={tab === "lua"}
          spellCheck={false}
          aria-label="Export text"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="min-h-4 text-xs text-signal">{message && <span className="inline-flex items-center gap-1"><Check className="size-3" />{message}</span>}</div>
      </DialogContent>
    </Dialog>
  );
}
