import { useEffect, useState } from "react";
import { ArrowUpRight, Moon, Redo2, Sun, Undo2 } from "lucide-react";
import { HelpDialog } from "@/components/help-dialog";
import { cn } from "@/lib/utils";

export function InstrumentHeader({ playing, canUndo, canRedo, onUndo, onRedo }: {
  playing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return <header className="instrument-header">
    <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><h1>beatling<span>Euclidean rhythm instrument</span></h1></div>
    <span className="model-label">EG–16 <span>/</span> 808 + 909 + 303 + 101</span>
    <div className="header-actions">
      <span className={cn("transport-status", playing && "running")}><i />{playing ? "Running" : "Standby"}</span>
      <div className="history-actions" aria-label="Edit history">
        <button className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo last change" title="Undo · ⌘/Ctrl Z"><Undo2 size={15} /></button>
        <button className="icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Redo last change" title="Redo · ⇧⌘/Ctrl Z"><Redo2 size={15} /></button>
      </div>
      <a href="https://www.luading.dev/" target="_blank" rel="noreferrer">Luading <ArrowUpRight size={12} /></a>
      <div className="header-guide-actions">
        <HelpDialog />
        <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
      </div>
    </div>
  </header>;
}
