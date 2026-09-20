import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { Dices, Download, ArrowUpRight, Cable, Eraser, ListMusic, Lock, LockOpen, Minus, Moon, Play, Plus, Redo2, RotateCcw, Square, Sun, Trash2, Undo2, Volume2, VolumeX } from "lucide-react";
import { SequencerEngine } from "@/audio/engine";
import { ExportDialog } from "@/components/export-dialog";
import { PatchPanel } from "@/components/patch-panel";
import { PatchCables } from "@/components/patch-cables";
import { OrbitView } from "@/components/orbit-view";
import { CABLE_SIGNALS } from "@/lib/cables";
import { connectionsFor } from "@/lib/routing";
import { SequencerCard } from "@/components/sequencer-card";
import { Button } from "@/components/ui/button";
import { VoiceBank } from "@/components/voice-bank";
import { RATE_OPTIONS, VOICE_DEFS } from "@/lib/constants";
import { effectiveBlock, volumeGain } from "@/lib/euclid";
import { createDemoPatch, createEmptyPatch, createRandomizationLocks, loadStoredPatch, randomizeBlock, randomizeBlockParameter, savePatch, shufflePatch } from "@/lib/patch";
import { createPresetPatch, PRESET_GROUPS } from "@/lib/presets";
import { changedBlockFields, changedVoiceFields, loadStoredArrangement, MAX_VARIATIONS, saveArrangement, variationHasChanges } from "@/lib/variations";
import type { BlockParam, BlockRandomizationLocks, BlockVisualState, EngineSnapshot, Patch, SequencerBlock, Variation, VoiceId, VoiceState } from "@/lib/types";
import { useDragNumber } from "@/hooks/use-drag-number";
import { cn } from "@/lib/utils";

const emptySnapshot = (patch: Patch): EngineSnapshot => ({
  clockPulse: -1,
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
  const [initialSetup] = useState(() => {
    const storedPatch = loadStoredPatch() ?? createDemoPatch();
    const initialArrangement = loadStoredArrangement(storedPatch);
    const initialPatch = initialArrangement.variations[initialArrangement.activeIndex].patch;
    return { initialPatch, initialArrangement };
  });
  const [engine] = useState(() => new SequencerEngine(initialSetup.initialPatch));
  type PatchHistory = { past: Patch[]; present: Patch; future: Patch[] };
  const initialHistory: PatchHistory = { past: [], present: initialSetup.initialPatch, future: [] };
  const [variations, setVariations] = useState<Variation[]>(initialSetup.initialArrangement.variations);
  const variationsRef = useRef(variations);
  const variationSerialRef = useRef(variations.length + 1);
  const [activeVariation, setActiveVariation] = useState(initialSetup.initialArrangement.activeIndex);
  const activeVariationRef = useRef(activeVariation);
  const [songMode, setSongMode] = useState(initialSetup.initialArrangement.songMode);
  const songModeRef = useRef(songMode);
  const songBarsRef = useRef(0);
  const historiesRef = useRef(new Map<string, PatchHistory>([[variations[activeVariation].id, initialHistory]]));
  const historyRef = useRef(initialHistory);
  const [history, setHistory] = useState(initialHistory);
  const patch = history.present;

  const storeVariations = useCallback((next: Variation[]) => {
    variationsRef.current = next;
    setVariations(next);
  }, []);

  const storeHistory = useCallback((next: PatchHistory) => {
    historyRef.current = next;
    historiesRef.current.set(variationsRef.current[activeVariationRef.current].id, next);
    setHistory(next);
  }, []);

  const setPatch = useCallback((action: SetStateAction<Patch>) => {
    const current = historyRef.current;
    const nextPatch = typeof action === "function" ? action(current.present) : action;
    if (nextPatch === current.present) return;
    engine.setPatch(nextPatch);
    const nextHistory = { past: [...current.past, current.present].slice(-100), present: nextPatch, future: [] };
    historyRef.current = nextHistory;
    historiesRef.current.set(variationsRef.current[activeVariationRef.current].id, nextHistory);
    setHistory(nextHistory);
    storeVariations(variationsRef.current.map((variation, index) => index === activeVariationRef.current ? { ...variation, patch: nextPatch } : variation));
  }, [engine, storeVariations]);
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(patch));
  const [playing, setPlaying] = useState(false);
  const [openPatch, setOpenPatch] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [presetId, setPresetId] = useState("");
  const [view, setView] = useState<"grid" | "circle">(() => {
    try { return localStorage.getItem("beatling-pattern-view") === "circle" ? "circle" : "grid"; }
    catch { return "grid"; }
  });
  const [selectedRhythm, setSelectedRhythm] = useState(0);
  const [circlePanel, setCirclePanel] = useState<"rhythm" | "voices">("rhythm");
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
    try { localStorage.setItem("beatling-pattern-view", view); }
    catch { /* View selection works without browser storage. */ }
  }, [view]);

  useEffect(() => {
    const timeout = window.setTimeout(() => savePatch(patch), 250);
    return () => window.clearTimeout(timeout);
  }, [patch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => saveArrangement({
      format: "euclid-grid.arrangement.v1",
      variations,
      activeIndex: activeVariation,
      songMode,
    }), 250);
    return () => window.clearTimeout(timeout);
  }, [activeVariation, songMode, variations]);

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

  const selectVariation = useCallback((index: number, resetPlayback = true) => {
    const variation = variationsRef.current[index];
    if (!variation || index === activeVariationRef.current) return;
    activeVariationRef.current = index;
    songBarsRef.current = 0;
    const nextHistory = historiesRef.current.get(variation.id) ?? { past: [], present: variation.patch, future: [] };
    historiesRef.current.set(variation.id, nextHistory);
    historyRef.current = nextHistory;
    engine.setPatch(nextHistory.present);
    setActiveVariation(index);
    setHistory(nextHistory);
    setOpenPatch(null);
    if (resetPlayback) engine.reset();
  }, [engine]);

  const addVariation = useCallback(() => {
    const current = variationsRef.current;
    if (current.length >= MAX_VARIATIONS) return;
    const nextIndex = current.length;
    const variation: Variation = {
      id: `variation-${Date.now()}-${variationSerialRef.current++}`,
      name: String.fromCharCode(65 + nextIndex),
      repeats: 1,
      patch: historyRef.current.present,
    };
    historiesRef.current.set(variation.id, { past: [], present: variation.patch, future: [] });
    storeVariations([...current, variation]);
    selectVariation(nextIndex);
  }, [selectVariation, storeVariations]);

  const deleteVariation = useCallback(() => {
    const index = activeVariationRef.current;
    if (index === 0 || variationsRef.current.length === 1) return;
    const removed = variationsRef.current[index];
    historiesRef.current.delete(removed.id);
    const next = variationsRef.current
      .filter((_variation, variationIndex) => variationIndex !== index)
      .map((variation, variationIndex) => ({ ...variation, name: String.fromCharCode(65 + variationIndex) }));
    storeVariations(next);
    activeVariationRef.current = -1;
    selectVariation(Math.min(index - 1, next.length - 1));
  }, [selectVariation, storeVariations]);

  const changeVariationRepeats = useCallback((delta: number) => {
    const index = activeVariationRef.current;
    const next = variationsRef.current.map((variation, variationIndex) => variationIndex === index
      ? { ...variation, repeats: Math.min(16, Math.max(1, variation.repeats + delta)) }
      : variation);
    storeVariations(next);
    songBarsRef.current = 0;
  }, [storeVariations]);

  const toggleSongMode = useCallback(() => {
    const next = !songModeRef.current;
    songModeRef.current = next;
    songBarsRef.current = 0;
    setSongMode(next);
  }, []);

  useEffect(() => {
    engine.setBarCallback(() => {
      const current = variationsRef.current;
      if (!songModeRef.current || current.length < 2) return;
      const currentIndex = activeVariationRef.current;
      songBarsRef.current += 1;
      if (songBarsRef.current < current[currentIndex].repeats) return;
      songBarsRef.current = 0;
      const nextIndex = (currentIndex + 1) % current.length;
      const nextVariation = current[nextIndex];
      const nextHistory = historiesRef.current.get(nextVariation.id) ?? { past: [], present: nextVariation.patch, future: [] };
      activeVariationRef.current = nextIndex;
      historyRef.current = nextHistory;
      engine.setPatch(nextHistory.present);
      setActiveVariation(nextIndex);
      setHistory(nextHistory);
      setOpenPatch(null);
      engine.resetPattern();
    });
    return () => engine.setBarCallback(null);
  }, [engine]);

  const togglePlayback = useCallback(async () => {
    if (engine.running) {
      engine.stop();
      setPlaying(false);
    } else {
      songBarsRef.current = 0;
      await engine.start();
      setPlaying(engine.running);
    }
  }, [engine]);

  const undo = useCallback(() => {
    const current = historyRef.current;
    const previous = current.past.at(-1);
    if (!previous) return;
    engine.setPatch(previous);
    const next = { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future].slice(0, 100) };
    storeHistory(next);
    storeVariations(variationsRef.current.map((variation, index) => index === activeVariationRef.current ? { ...variation, patch: previous } : variation));
  }, [engine, storeHistory, storeVariations]);

  const redo = useCallback(() => {
    const current = historyRef.current;
    const nextPatch = current.future[0];
    if (!nextPatch) return;
    engine.setPatch(nextPatch);
    const next = { past: [...current.past, current.present].slice(-100), present: nextPatch, future: current.future.slice(1) };
    storeHistory(next);
    storeVariations(variationsRef.current.map((variation, index) => index === activeVariationRef.current ? { ...variation, patch: nextPatch } : variation));
  }, [engine, storeHistory, storeVariations]);

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
  const basePatch = variations[0]?.patch ?? patch;
  const blockVariationChanges = useMemo(() => patch.blocks.map((block, index) => activeVariation === 0 ? new Set<keyof SequencerBlock>() : changedBlockFields(block, basePatch.blocks[index])), [activeVariation, basePatch, patch.blocks]);
  const voiceVariationChanges = useMemo(() => Object.fromEntries(VOICE_DEFS.map(({ id }) => [id, activeVariation === 0 ? new Set<keyof VoiceState>() : changedVoiceFields(patch.voices[id], basePatch.voices[id])])) as Record<VoiceId, Set<keyof VoiceState>>, [activeVariation, basePatch, patch.voices]);
  const allSettingsLocked = randomizationLocks.every((blockLocks) => Object.values(blockLocks).every(Boolean));
  const allVoicesMuted = Object.values(patch.voices).every((voice) => voice.mute);

  const selectRhythm = (index: number) => {
    setSelectedRhythm(index);
    setCirclePanel("rhythm");
  };

  const switchPatternView = (mode: "grid" | "circle") => {
    setView(mode);
    if (mode === "circle") {
      setCirclePanel("rhythm");
      if (openPatch !== null) setSelectedRhythm(openPatch);
    }
    setOpenPatch(null);
  };

  const renderCard = (index: number, showDial = true) => <SequencerCard key={index} showDial={showDial} index={index} block={patch.blocks[index]} blocks={patch.blocks} visual={visualFor(index)} patchOpen={showDial && openPatch === index} related={showDial && openPatch !== null && connections.some((connection) => (connection.source === openPatch && connection.target === index) || (connection.target === openPatch && connection.source === index))} locks={randomizationLocks[index]} changedFields={blockVariationChanges[index]} onPatchOpen={showDial ? setOpenPatch : () => document.getElementById("circle-routing")?.scrollIntoView({ behavior: "instant", block: "nearest" })} onChange={(next) => updateBlock(index, next)} onRandomize={() => updateBlock(index, randomizeBlock(patch.blocks[index], index, randomizationLocks[index]))} onLockToggle={() => setBlockLocks(index, !Object.values(randomizationLocks[index]).every(Boolean))} onParameterRandomize={(parameter) => updateBlock(index, randomizeBlockParameter(patch.blocks[index], index, parameter))} onParameterLockToggle={(parameter) => toggleParameterLock(index, parameter)} />;

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
          <div className="section-heading pattern-heading">
            <div className="pattern-title"><h2>Pattern {view === "grid" ? "grid" : "circle"}</h2><div className="view-switch" role="group" aria-label="Pattern view">{(["grid", "circle"] as const).map((mode) => <button type="button" key={mode} aria-pressed={view === mode} onClick={() => switchPatternView(mode)}>{mode === "grid" ? "Grid" : "Circle"}</button>)}</div><span className="section-meta">16 independent sequences</span></div>
            <div className="variation-toolbar">
              <button type="button" className="song-mode-button" aria-pressed={songMode} onClick={toggleSongMode} title="Play variations in order"><ListMusic size={12} />Song</button>
              <div className="variation-tabs" role="tablist" aria-label="Pattern variations">
                {variations.map((variation, index) => {
                  const changed = index > 0 && variationHasChanges(variation, variations[0]);
                  return <button type="button" role="tab" key={variation.id} aria-selected={activeVariation === index} aria-label={`Variation ${variation.name}, ${variation.repeats} ${variation.repeats === 1 ? "bar" : "bars"}`} className={cn(changed && "has-changes")} onClick={() => selectVariation(index)} title={changed ? `Variation ${variation.name} has changes from A` : `Variation ${variation.name}`}><span>{variation.name}</span><small>×{variation.repeats}</small></button>;
                })}
                <button type="button" className="add-variation" aria-label="Add variation" onClick={addVariation} disabled={variations.length >= MAX_VARIATIONS} title="Duplicate the current variation"><Plus size={12} /></button>
              </div>
              <div className="repeat-control" aria-label={`Repeat count for variation ${variations[activeVariation].name}`}>
                <button type="button" onClick={() => changeVariationRepeats(-1)} disabled={variations[activeVariation].repeats <= 1} aria-label="Decrease repeat count"><Minus size={10} /></button>
                <output>{variations[activeVariation].repeats}<span className="repeat-unit"> {variations[activeVariation].repeats === 1 ? "bar" : "bars"}</span></output>
                <button type="button" onClick={() => changeVariationRepeats(1)} disabled={variations[activeVariation].repeats >= 16} aria-label="Increase repeat count"><Plus size={10} /></button>
              </div>
              {activeVariation > 0 && <button type="button" className="delete-variation" aria-label={`Delete variation ${variations[activeVariation].name}`} onClick={deleteVariation} title="Delete selected variation"><Trash2 size={11} /></button>}
            </div>
            <div className="grid-actions"><button onClick={() => applyPatch(shufflePatch(patch, Math.random, randomizationLocks))} title="Shuffle unlocked settings, preserving routing" disabled={allSettingsLocked}><Dices size={13} />Shuffle</button><button className="lock-all-button" aria-pressed={allSettingsLocked} onClick={() => setRandomizationLocks(createRandomizationLocks(!allSettingsLocked))} title={allSettingsLocked ? "Unlock every pattern setting" : "Lock every pattern setting"}>{allSettingsLocked ? <Lock size={12} /> : <LockOpen size={12} />}{allSettingsLocked ? "Unlock all" : "Lock all"}</button><button onClick={() => applyPatch(createEmptyPatch(patch.vol))}><Eraser size={13} />Clear</button></div>
          </div>
          {view === "grid" ? <><div className="cable-controls">
            <button type="button" className="cable-toggle" role="switch" aria-checked={showCables} onClick={() => setShowCables((current) => !current)}><Cable size={13} />Patch cables<span className="toggle-track" aria-hidden="true"><i /></span></button>
            {showCables && <span className="cable-legend">{CABLE_SIGNALS.map((signal) => <span key={signal.input}><i style={{ background: signal.color }} />{signal.input}</span>)}</span>}
            {showCables && <span className="cable-hint">Hover a block to see through cables</span>}
          </div>
          <div className={cn("sequencer-grid", showCables && "cables-visible")}>
            {patch.blocks.map((_block, index) => renderCard(index))}
            {showCables && <PatchCables connections={connections} />}
          </div>
          </> : <OrbitView blocks={patch.blocks} visuals={patch.blocks.map((_block, index) => visualFor(index))} clockPulse={playing ? snapshot.clockPulse : -1} selected={selectedRhythm} onSelect={selectRhythm} />}
          <div className="grid-legend"><span><i className="legend-dot" /> Hit <i className="legend-dot hollow" /> Rest <i className="legend-dot accent" /> Playhead</span><span><Cable size={12} />{connections.length} block connections · Select Patch to trace a signal</span></div>
        </section>
        <aside className={cn("side-panel", view === "circle" && "circle-side-panel", openPatch !== null && "patch-visible")}>
          {view === "circle" && <div className="circle-panel-switch" role="group" aria-label="Circle sidebar"><button type="button" aria-pressed={circlePanel === "rhythm"} onClick={() => setCirclePanel("rhythm")}>Rhythm settings</button><button type="button" aria-pressed={circlePanel === "voices"} onClick={() => setCirclePanel("voices")}>Voice bank</button></div>}
          {view === "circle" && circlePanel === "rhythm" ? <div className="circle-inspector" role="region" aria-label={`Settings for block ${String(selectedRhythm + 1).padStart(2, "0")}`}>
            <div className="circle-inspector-title"><span className="eyebrow">Selected rhythm / {String(selectedRhythm + 1).padStart(2, "0")}</span><p>One ring, one rhythm. Adjust it here.</p></div>
            {renderCard(selectedRhythm, false)}
            <div id="circle-routing"><PatchPanel embedded index={selectedRhythm} blocks={patch.blocks} onChange={(next) => updateBlock(selectedRhythm, next)} onSelect={selectRhythm} onClose={() => undefined} /></div>
          </div> : <>

          {openPatch !== null ? <PatchPanel index={openPatch} blocks={patch.blocks} onChange={(next) => updateBlock(openPatch, next)} onSelect={setOpenPatch} onClose={() => setOpenPatch(null)} /> : <><div className="section-heading voice-bank-heading"><div><h2>Voice bank</h2><span className="section-meta">12 voices</span></div><button className="voice-bank-master" aria-pressed={allVoicesMuted} onClick={() => setAllVoicesMuted(!allVoicesMuted)}>{allVoicesMuted ? <Volume2 size={12} /> : <VolumeX size={12} />}{allVoicesMuted ? "Unmute all" : "Mute all"}</button></div><VoiceBank voices={patch.voices} activeVoices={snapshot.activeVoices} changedFields={voiceVariationChanges} onChange={updateVoice} /><div className="voice-bank-note"><span className="jack" />808 / 909 · Select a model to switch</div></>}
          </>}
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
