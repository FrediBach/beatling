import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { Dices, Download, ArrowUpRight, Cable, Eraser, Lock, LockOpen, Moon, Play, Redo2, RotateCcw, Square, Sun, Undo2, Volume2, VolumeX } from "lucide-react";
import { SequencerEngine } from "@/audio/engine";
import { ExportDialog } from "@/components/export-dialog";
import { PatchPanel } from "@/components/patch-panel";
import { PatchCables } from "@/components/patch-cables";
import { CABLE_SIGNALS } from "@/lib/cables";
import { connectionsFor } from "@/lib/routing";
import { SequencerCard } from "@/components/sequencer-card";
import { Button } from "@/components/ui/button";
import { VoiceBank } from "@/components/voice-bank";
import { RATE_OPTIONS, VOICE_DEFS } from "@/lib/constants";
import { effectiveBlock, volumeGain } from "@/lib/euclid";
import { createDemoPatch, createEmptyPatch, createRandomizationLocks, loadStoredPatch, randomizeBlock, randomizeBlockParameter, savePatch, shufflePatch } from "@/lib/patch";
import { createPresetPatch, PRESET_GROUPS } from "@/lib/presets";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, EngineSnapshot, Patch, SequencerBlock, VoiceId, VoiceState } from "@/lib/types";
import { useDragNumber } from "@/hooks/use-drag-number";
import { cn } from "@/lib/utils";

const emptySnapshot = (patch: Patch): EngineSnapshot => ({
  blocks: patch.blocks.map((block) => ({
    position: -1,
    lfo: 0,
    fire: false,
    muted: block.mute,
    effective: effectiveBlock(block),
  })),
  activeVoices: {},
});

export default function App() {
  const [model] = useState(() => {
    const initialPatch = loadStoredPatch() ?? createDemoPatch();
    const source = { patch: initialPatch };
    return { initialPatch, source, engine: new SequencerEngine(() => source.patch) };
  });
  const { engine } = model;
  const [history, setHistory] = useState(() => ({ past: [] as Patch[], present: model.initialPatch, future: [] as Patch[] }));
  const patch = history.present;
  const setPatch = useCallback((action: SetStateAction<Patch>) => {
    setHistory((current) => {
      const next = typeof action === "function" ? action(current.present) : action;
      if (next === current.present) return current;
      model.source.patch = next;
      return {
        past: [...current.past, current.present].slice(-100),
        present: next,
        future: [],
      };
    });
  }, [model]);
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(patch));
  const [playing, setPlaying] = useState(false);
  const [openPatch, setOpenPatch] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [presetId, setPresetId] = useState("");
  const [showCables, setShowCables] = useState(() => {
    try { return localStorage.getItem("beatling-show-cables") === "true"; }
    catch { return false; }
  });
  const [randomizationLocks, setRandomizationLocks] = useState<BlockRandomizationLocks[]>(() => createRandomizationLocks());
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem("beatling-show-cables", String(showCables)); }
    catch { /* The toggle still works when browser storage is unavailable. */ }
  }, [showCables]);

  useEffect(() => {
    const timeout = window.setTimeout(() => savePatch(patch), 250);
    return () => window.clearTimeout(timeout);
  }, [patch]);

  useEffect(() => {
    engine.setVolume(patch.vol);
  }, [engine, patch.vol]);

  useEffect(() => {
    let animationFrame = 0;
    const frame = () => {
      setSnapshot(engine.snapshot());
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, [engine]);

  useEffect(() => () => engine.destroy(), [engine]);

  const togglePlayback = useCallback(async () => {
    if (engine.running) {
      engine.stop();
      setPlaying(false);
    } else {
      await engine.start();
      setPlaying(engine.running);
    }
  }, [engine]);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      model.source.patch = previous;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, 100),
      };
    });
  }, [model]);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      model.source.patch = next;
      return {
        past: [...current.past, current.present].slice(-100),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, [model]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (!editable && modifier && !event.altKey && ((key === "z" && event.shiftKey) || key === "y")) {
        event.preventDefault();
        redo();
        return;
      }
      if (!editable && modifier && !event.altKey && key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "Escape" && openPatch !== null) {
        document.querySelector<HTMLButtonElement>(`[aria-label="Patch block ${String(openPatch + 1).padStart(2, "0")}"]`)?.focus();
        setOpenPatch(null);
        return;
      }
      if (event.code !== "Space") return;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      event.preventDefault();
      void togglePlayback();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback, openPatch, redo, undo]);

  const updateGlobal = <K extends keyof Pick<Patch, "bpm" | "rate" | "swing" | "vol">>(key: K, value: Patch[K]) => {
    setPatch((current) => ({ ...current, [key]: value }));
  };

  const updateBlock = (index: number, block: SequencerBlock) => {
    setPatch((current) => ({ ...current, blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? block : item) }));
  };

  const setBlockLocks = (index: number, locked: boolean) => {
    setRandomizationLocks((current) => current.map((blockLocks, blockIndex) => blockIndex === index
      ? Object.fromEntries(Object.keys(blockLocks).map((parameter) => [parameter, locked])) as BlockRandomizationLocks
      : blockLocks));
  };

  const toggleParameterLock = (index: number, parameter: BlockParam) => {
    setRandomizationLocks((current) => current.map((blockLocks, blockIndex) => blockIndex === index
      ? { ...blockLocks, [parameter]: !blockLocks[parameter] }
      : blockLocks));
  };

  const updateVoice = (id: VoiceId, voice: VoiceState) => {
    setPatch((current) => ({ ...current, voices: { ...current.voices, [id]: voice } }));
  };

  const setAllVoicesMuted = (muted: boolean) => {
    setPatch((current) => ({
      ...current,
      voices: Object.fromEntries(VOICE_DEFS.map(({ id }) => [id, { ...current.voices[id], mute: muted }])) as Patch["voices"],
    }));
  };

  const applyPatch = (next: Patch) => {
    engine.reset();
    setPatch(next);
    setSnapshot(emptySnapshot(next));
    setOpenPatch(null);
  };

  const visualFor = (index: number): BlockVisualState => {
    const visual = snapshot.blocks[index] ?? emptySnapshot(patch).blocks[index];
    if (!playing) {
      const block = patch.blocks[index];
      const sourceLfo = block.modSrc === "" ? 0 : (snapshot.blocks[Number(block.modSrc)]?.lfo ?? 0);
      return { ...visual, effective: effectiveBlock(block, sourceLfo), muted: block.mute };
    }
    return visual;
  };

  const connections = useMemo(() => connectionsFor(patch.blocks), [patch.blocks]);
  const allSettingsLocked = randomizationLocks.every((blockLocks) => Object.values(blockLocks).every(Boolean));
  const allVoicesMuted = Object.values(patch.voices).every((voice) => voice.mute);

  return (
    <div className="instrument">
      <header className="instrument-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><h1>beatling<span>Euclidean rhythm instrument</span></h1></div>
        <span className="model-label">EG–16 <span>/</span> 808 + 909</span>
        <div className="header-actions">
          <span className={cn("transport-status", playing && "running")}><i />{playing ? "Running" : "Standby"}</span>
          <div className="history-actions" aria-label="Edit history">
            <button className="icon-button" onClick={undo} disabled={history.past.length === 0} aria-label="Undo last change" title="Undo · ⌘/Ctrl Z"><Undo2 size={15} /></button>
            <button className="icon-button" onClick={redo} disabled={history.future.length === 0} aria-label="Redo last change" title="Redo · ⇧⌘/Ctrl Z"><Redo2 size={15} /></button>
          </div>
          <a href="https://www.luading.dev/" target="_blank" rel="noreferrer">Luading <ArrowUpRight size={12} /></a>
          <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
        </div>
      </header>

      <section className="transport-bar" aria-label="Transport and global controls">
        <div className="play-controls"><button aria-label={playing ? "Stop" : "Play"} className={cn("play-button", playing && "playing")} onClick={() => void togglePlayback()}>{playing ? <Square size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}{playing ? "Stop" : "Play"}<kbd>space</kbd></button><button className="reset-button" onClick={() => engine.reset()} aria-label="Reset all blocks" title="Reset every block to step 1"><RotateCcw size={16} /></button></div>
        <div className="tempo-section"><span className="eyebrow">Tempo</span><TempoControl value={patch.bpm} onChange={(value) => updateGlobal("bpm", value)} /></div>
        <div className="clock-section"><span className="eyebrow">Clock division</span><div className="rate-options">{RATE_OPTIONS.map((option) => <button key={option.value} aria-pressed={patch.rate === option.value} onClick={() => updateGlobal("rate", option.value)}>{option.label}</button>)}</div></div>
        <div className="global-range"><LabeledRange label="Swing" min={0} max={70} value={patch.swing} display={`${patch.swing}%`} onChange={(value) => updateGlobal("swing", value)} /></div>
        <div className="global-range master-range"><LabeledRange label="Master" min={0} max={100} value={patch.vol} display={`${patch.vol === 0 ? "−∞" : Math.round(20 * Math.log10(volumeGain(patch.vol)))} dB`} onChange={(value) => updateGlobal("vol", value)} /></div>
        <div className="session-actions">
          <select
            className="preset-select"
            aria-label="Drum pattern preset"
            value={presetId}
            onChange={(event) => {
              const nextPreset = event.target.value;
              setPresetId(nextPreset);
              applyPatch(createPresetPatch(nextPreset, patch.vol));
            }}
          >
            <option value="" disabled>Presets</option>
            {PRESET_GROUPS.map((group) => <optgroup key={group.category} label={group.category}>{group.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>)}
          </select>
          <Button variant="outline" onClick={() => { setPresetId(""); applyPatch(createDemoPatch(patch.vol)); }}>Load demo</Button>
          <Button variant="outline" onClick={() => setExportOpen(true)}><Download size={13} />Export</Button>
        </div>
      </section>

      <main className="workspace">
        <section className="sequencer-section" aria-label="Sequencer blocks">
          <div className="section-heading"><div><h2>Pattern grid</h2><span className="section-meta">16 independent sequences</span></div><div className="grid-actions"><button onClick={() => applyPatch(shufflePatch(patch, Math.random, randomizationLocks))} title="Shuffle unlocked settings, preserving routing" disabled={allSettingsLocked}><Dices size={13} />Shuffle</button><button className="lock-all-button" aria-pressed={allSettingsLocked} onClick={() => setRandomizationLocks(createRandomizationLocks(!allSettingsLocked))} title={allSettingsLocked ? "Unlock every pattern setting" : "Lock every pattern setting"}>{allSettingsLocked ? <Lock size={12} /> : <LockOpen size={12} />}{allSettingsLocked ? "Unlock all" : "Lock all"}</button><button onClick={() => applyPatch(createEmptyPatch(patch.vol))}><Eraser size={13} />Clear</button></div></div>
          <div className="cable-controls">
            <button type="button" className="cable-toggle" role="switch" aria-checked={showCables} onClick={() => setShowCables((current) => !current)}><Cable size={13} />Patch cables<span className="toggle-track" aria-hidden="true"><i /></span></button>
            {showCables && <span className="cable-legend">{CABLE_SIGNALS.map((signal) => <span key={signal.input}><i style={{ background: signal.color }} />{signal.input}</span>)}</span>}
            {showCables && <span className="cable-hint">Hover a block to see through cables</span>}
          </div>
          <div className={cn("sequencer-grid", showCables && "cables-visible")}>
            {patch.blocks.map((block, index) => <SequencerCard key={index} index={index} block={block} blocks={patch.blocks} visual={visualFor(index)} patchOpen={openPatch === index} related={openPatch !== null && connections.some((connection) => (connection.source === openPatch && connection.target === index) || (connection.target === openPatch && connection.source === index))} locks={randomizationLocks[index]} onPatchOpen={setOpenPatch} onChange={(next) => updateBlock(index, next)} onRandomize={() => updateBlock(index, randomizeBlock(block, index, randomizationLocks[index]))} onLockToggle={() => setBlockLocks(index, !Object.values(randomizationLocks[index]).every(Boolean))} onParameterRandomize={(parameter) => updateBlock(index, randomizeBlockParameter(block, index, parameter))} onParameterLockToggle={(parameter) => toggleParameterLock(index, parameter)} />)}
            {showCables && <PatchCables connections={connections} />}
          </div>
          <div className="grid-legend"><span><i className="legend-dot" /> Hit <i className="legend-dot hollow" /> Rest <i className="legend-dot accent" /> Playhead</span><span><Cable size={12} />{connections.length} block connections · Select Patch to trace a signal</span></div>
        </section>
        <aside className={cn("side-panel", openPatch !== null && "patch-visible")}>
          {openPatch !== null ? <PatchPanel index={openPatch} blocks={patch.blocks} onChange={(next) => updateBlock(openPatch, next)} onSelect={setOpenPatch} onClose={() => setOpenPatch(null)} /> : <><div className="section-heading voice-bank-heading"><div><h2>Voice bank</h2><span className="section-meta">12 voices</span></div><button className="voice-bank-master" aria-pressed={allVoicesMuted} onClick={() => setAllVoicesMuted(!allVoicesMuted)}>{allVoicesMuted ? <Volume2 size={12} /> : <VolumeX size={12} />}{allVoicesMuted ? "Unmute all" : "Mute all"}</button></div><VoiceBank voices={patch.voices} activeVoices={snapshot.activeVoices} onChange={updateVoice} /><div className="voice-bank-note"><span className="jack" />808 / 909 · Select a model to switch</div></>}
        </aside>
      </main>
      <footer className="instrument-footer"><span><kbd>space</kbd> play / stop</span><span><kbd>↑</kbd> <kbd>↓</kbd> or drag to adjust · <kbd>shift</kbd> for larger steps</span><span className="footer-signoff">RHYTHM, BY DESIGN. <span>EG–16</span></span></footer>
      {exportOpen && <ExportDialog open onOpenChange={setExportOpen} patch={patch} onLoad={applyPatch} />}
    </div>
  );
}

function TempoControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const clampedChange = (next: number) => onChange(Math.min(300, Math.max(20, Math.round(next))));
  const drag = useDragNumber({ value, onChange: clampedChange, sensitivity: 4 });
  return (
    <div className="tempo-control" {...drag}>
      <input
        className="min-w-0 flex-1 bg-transparent font-mono text-[29px] leading-none tracking-[-.04em] tabular-nums outline-none"
        type="text"
        inputMode="numeric"
        aria-label="Beats per minute"
        value={value}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(next)) clampedChange(next);
        }}
      />
      <span className="pb-0.5 font-mono text-[10px] text-muted">bpm</span>
    </div>
  );
}

function LabeledRange({ label, min, max, value, display, onChange }: { label: string; min: number; max: number; value: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="labeled-range">
      {label}<output className="font-mono text-ink">{display}</output>
      <input className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
