import { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState, type SetStateAction } from "react";
import { Dices, Cable, Eraser, GripVertical, ListMusic, Lock, LockOpen, Minus, Play, Plus, RotateCcw, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { SequencerEngine } from "@/audio/engine";
import { InstrumentHeader } from "@/components/instrument-header";
import { ExportDialog } from "@/components/export-dialog";
import { EffectsMixer } from "@/components/effects-mixer";
import { PatchPanel } from "@/components/patch-panel";
import { PatchCables } from "@/components/patch-cables";
import { OrbitView } from "@/components/orbit-view";
import { CABLE_SIGNALS } from "@/lib/cables";
import { connectionsFor } from "@/lib/routing";
import { SequencerCard } from "@/components/sequencer-card";
import { SessionPresetControls } from "@/components/session-preset-controls";
import { VoiceBank } from "@/components/voice-bank";
import { RATE_OPTIONS, VOICE_DEFS } from "@/lib/constants";
import { effectiveBlock, volumeGain } from "@/lib/euclid";
import { createDemoPatch, createEmptyPatch, createRandomizationLocks, loadStoredPatch, randomizeBlock, randomizeBlockParameter, savePatch, shufflePatch } from "@/lib/patch";
import { changedBlockFields, changedVoiceFields, loadStoredArrangement, MAX_VARIATIONS, saveArrangement, variationHasChanges } from "@/lib/variations";
import { BLOCK_COUNT, type Arrangement, type BlockParam, type BlockRandomizationLocks, type BlockVisualState, type EffectsState, type EngineSnapshot, type Patch, type SequencerBlock, type SongPart, type Variation, type VoiceId, type VoiceState } from "@/lib/types";
import { useDragNumber } from "@/hooks/use-drag-number";
import { cn } from "@/lib/utils";

const emptySnapshot = (patch: Patch): EngineSnapshot => ({
  clockPulse: -1,
  blocks: patch.blocks.map((block) => ({
    position: -1,
    rhythmIndex: 0,
    lfo: 0,
    fire: false,
    muted: block.mute,
    effective: effectiveBlock(block),
  })),
  activeVoices: {},
});

const BLOCK_SLOTS = Array.from({ length: BLOCK_COUNT }, (_, index) => ({
  index,
  key: `block-${index + 1}`,
}));

type PatchHistory = { past: Patch[]; present: Patch; future: Patch[] };

const blockVoiceState = (patch: Patch, index: number): VoiceState | undefined => {
  const block = patch.blocks[index];
  const voice = block.kind === "bernoulli" ? block.branchVoices[0] : block.voice;
  return voice ? patch.voices[voice] : undefined;
};

export default function App() {
  const [initialSetup] = useState(() => {
    const storedPatch = loadStoredPatch() ?? createDemoPatch();
    const initialArrangement = loadStoredArrangement(storedPatch);
    const initialPatch = initialArrangement.variations[initialArrangement.activeIndex].patch;
    return { initialPatch, initialArrangement };
  });
  const [engine] = useState(() => new SequencerEngine(initialSetup.initialPatch));
  const [initialHistory] = useState<PatchHistory>(() => ({ past: [], present: initialSetup.initialPatch, future: [] }));
  const [variations, setVariations] = useState<Variation[]>(initialSetup.initialArrangement.variations);
  const variationsRef = useRef(variations);
  const variationSerialRef = useRef(variations.length + 1);
  const [songParts, setSongParts] = useState<SongPart[]>(initialSetup.initialArrangement.songParts);
  const songPartsRef = useRef(songParts);
  const songPartSerialRef = useRef(songParts.length + 1);
  const [activeVariation, setActiveVariation] = useState(initialSetup.initialArrangement.activeIndex);
  const activeVariationRef = useRef(activeVariation);
  const [activeSongPart, setActiveSongPart] = useState(initialSetup.initialArrangement.activeSongPartIndex);
  const activeSongPartRef = useRef(activeSongPart);
  const [songMode, setSongMode] = useState(initialSetup.initialArrangement.songMode);
  const songModeRef = useRef(songMode);
  const songBarsRef = useRef(0);
  const [initialHistories] = useState(() => new Map<string, PatchHistory>([[variations[activeVariation].id, initialHistory]]));
  const historiesRef = useRef(initialHistories);
  const historyRef = useRef(initialHistory);
  const [history, setHistory] = useState(initialHistory);
  const patch = history.present;

  const storeVariations = useCallback((next: Variation[]) => {
    variationsRef.current = next;
    setVariations(next);
  }, []);

  const storeSongParts = useCallback((next: SongPart[]) => {
    songPartsRef.current = next;
    setSongParts(next);
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
  const [draggedSongPart, setDraggedSongPart] = useState<string | null>(null);
  const [randomizationLocks, setRandomizationLocks] = useState<BlockRandomizationLocks[]>(() => createRandomizationLocks());
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
      format: "euclid-grid.arrangement.v9",
      variations,
      songParts,
      activeIndex: activeVariation,
      activeSongPartIndex: activeSongPart,
      songMode,
    }), 250);
    return () => window.clearTimeout(timeout);
  }, [activeSongPart, activeVariation, songMode, songParts, variations]);

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
      patch: historyRef.current.present,
    };
    const songPart: SongPart = {
      id: `song-part-${Date.now()}-${songPartSerialRef.current++}`,
      variationId: variation.id,
      bars: 1,
    };
    historiesRef.current.set(variation.id, { past: [], present: variation.patch, future: [] });
    storeVariations([...current, variation]);
    storeSongParts([...songPartsRef.current, songPart]);
    activeSongPartRef.current = songPartsRef.current.length - 1;
    setActiveSongPart(activeSongPartRef.current);
    selectVariation(nextIndex);
  }, [selectVariation, storeSongParts, storeVariations]);

  const deleteVariation = useCallback(() => {
    const index = activeVariationRef.current;
    if (index === 0 || variationsRef.current.length === 1) return;
    const removed = variationsRef.current[index];
    historiesRef.current.delete(removed.id);
    const next = variationsRef.current
      .filter((_variation, variationIndex) => variationIndex !== index)
      .map((variation, variationIndex) => ({ ...variation, name: String.fromCharCode(65 + variationIndex) }));
    const nextSongParts = songPartsRef.current.filter((part) => part.variationId !== removed.id);
    storeVariations(next);
    storeSongParts(nextSongParts);
    activeSongPartRef.current = Math.min(activeSongPartRef.current, nextSongParts.length - 1);
    setActiveSongPart(activeSongPartRef.current);
    activeVariationRef.current = -1;
    selectVariation(Math.min(index - 1, next.length - 1));
  }, [selectVariation, storeSongParts, storeVariations]);

  const selectSongPart = useCallback((index: number, resetPlayback = true) => {
    const part = songPartsRef.current[index];
    if (!part) return;
    activeSongPartRef.current = index;
    setActiveSongPart(index);
    songBarsRef.current = 0;
    const variationIndex = variationsRef.current.findIndex((variation) => variation.id === part.variationId);
    if (variationIndex < 0) return;
    if (variationIndex === activeVariationRef.current) {
      if (resetPlayback) engine.reset();
      return;
    }
    selectVariation(variationIndex, resetPlayback);
  }, [engine, selectVariation]);

  const selectPattern = useCallback((index: number) => {
    const variation = variationsRef.current[index];
    if (!variation) return;
    const firstPart = songPartsRef.current.findIndex((part) => part.variationId === variation.id);
    if (firstPart >= 0) {
      activeSongPartRef.current = firstPart;
      setActiveSongPart(firstPart);
    }
    selectVariation(index);
  }, [selectVariation]);

  const addSongPart = useCallback(() => {
    const current = songPartsRef.current;
    const insertAt = Math.min(current.length, activeSongPartRef.current + 1);
    const part: SongPart = {
      id: `song-part-${Date.now()}-${songPartSerialRef.current++}`,
      variationId: variationsRef.current[activeVariationRef.current].id,
      bars: 1,
    };
    const next = [...current.slice(0, insertAt), part, ...current.slice(insertAt)];
    storeSongParts(next);
    activeSongPartRef.current = insertAt;
    setActiveSongPart(insertAt);
    songBarsRef.current = 0;
  }, [storeSongParts]);

  const changeSongPartBars = useCallback((delta: number) => {
    const index = activeSongPartRef.current;
    const next = songPartsRef.current.map((part, partIndex) => partIndex === index
      ? { ...part, bars: Math.min(16, Math.max(1, part.bars + delta)) }
      : part);
    storeSongParts(next);
    songBarsRef.current = 0;
  }, [storeSongParts]);

  const deleteSongPart = useCallback(() => {
    if (songPartsRef.current.length <= 1) return;
    const index = activeSongPartRef.current;
    const next = songPartsRef.current.filter((_part, partIndex) => partIndex !== index);
    storeSongParts(next);
    selectSongPart(Math.min(index, next.length - 1));
  }, [selectSongPart, storeSongParts]);

  const moveSongPart = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const current = songPartsRef.current;
    const sourceIndex = current.findIndex((part) => part.id === sourceId);
    const targetIndex = current.findIndex((part) => part.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const selectedId = current[activeSongPartRef.current]?.id;
    const next = [...current];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    storeSongParts(next);
    const nextSelectedIndex = next.findIndex((part) => part.id === selectedId);
    activeSongPartRef.current = nextSelectedIndex;
    setActiveSongPart(nextSelectedIndex);
  }, [storeSongParts]);

  const moveActiveSongPartBy = useCallback((delta: number) => {
    const currentIndex = activeSongPartRef.current;
    const targetIndex = Math.min(songPartsRef.current.length - 1, Math.max(0, currentIndex + delta));
    if (targetIndex === currentIndex) return;
    moveSongPart(songPartsRef.current[currentIndex].id, songPartsRef.current[targetIndex].id);
  }, [moveSongPart]);

  const toggleSongMode = useCallback(() => {
    const next = !songModeRef.current;
    songModeRef.current = next;
    songBarsRef.current = 0;
    setSongMode(next);
    if (next) selectSongPart(activeSongPartRef.current);
  }, [selectSongPart]);

  useEffect(() => {
    engine.setBarCallback(() => {
      const current = songPartsRef.current;
      if (!songModeRef.current || current.length === 0) return;
      const currentIndex = activeSongPartRef.current;
      songBarsRef.current += 1;
      if (songBarsRef.current < current[currentIndex].bars) return;
      songBarsRef.current = 0;
      const nextIndex = (currentIndex + 1) % current.length;
      const nextPart = current[nextIndex];
      const variationIndex = variationsRef.current.findIndex((variation) => variation.id === nextPart.variationId);
      if (variationIndex < 0) return;
      const nextVariation = variationsRef.current[variationIndex];
      const nextHistory = historiesRef.current.get(nextVariation.id) ?? { past: [], present: nextVariation.patch, future: [] };
      activeSongPartRef.current = nextIndex;
      activeVariationRef.current = variationIndex;
      historyRef.current = nextHistory;
      engine.setPatch(nextHistory.present);
      setActiveSongPart(nextIndex);
      setActiveVariation(variationIndex);
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

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
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
  });

  useEffect(() => {
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, []);

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

  const updateEffects = (effects: EffectsState) => {
    setPatch((current) => ({ ...current, effects }));
  };

  const setAllVoicesMuted = (muted: boolean) => {
    setPatch((current) => ({
      ...current,
      voices: Object.fromEntries(VOICE_DEFS.map(({ id }) => [id, { ...current.voices[id], mute: muted }])) as Patch["voices"],
    }));
  };

  const applyPatch = (next: Patch) => {
    setPatch(next);
    engine.reset();
    setSnapshot(emptySnapshot(next));
    setOpenPatch(null);
  };

  const applyArrangement = (next: Arrangement) => {
    const activeIndex = Math.min(next.variations.length - 1, Math.max(0, next.activeIndex));
    const active = next.variations[activeIndex];
    const nextHistories = new Map<string, PatchHistory>(next.variations.map((variation) => [variation.id, { past: [], present: variation.patch, future: [] }]));
    const nextHistory = nextHistories.get(active.id)!;
    variationsRef.current = next.variations;
    songPartsRef.current = next.songParts;
    activeVariationRef.current = activeIndex;
    activeSongPartRef.current = Math.min(next.songParts.length - 1, Math.max(0, next.activeSongPartIndex));
    songModeRef.current = next.songMode;
    songBarsRef.current = 0;
    variationSerialRef.current = next.variations.length + 1;
    songPartSerialRef.current = next.songParts.length + 1;
    historiesRef.current = nextHistories;
    historyRef.current = nextHistory;
    engine.setPatch(active.patch);
    engine.reset();
    setVariations(next.variations);
    setSongParts(next.songParts);
    setActiveVariation(activeIndex);
    setActiveSongPart(activeSongPartRef.current);
    setSongMode(next.songMode);
    setHistory(nextHistory);
    setSnapshot(emptySnapshot(active.patch));
    setOpenPatch(null);
  };

  const currentArrangement = useMemo<Arrangement>(() => ({
    format: "euclid-grid.arrangement.v9",
    variations,
    songParts,
    activeIndex: activeVariation,
    activeSongPartIndex: activeSongPart,
    songMode,
  }), [activeSongPart, activeVariation, songMode, songParts, variations]);
  const visualFor = (index: number): BlockVisualState => {
    const visual = snapshot.blocks[index] ?? emptySnapshot(patch).blocks[index];
    if (!playing) {
      const block = patch.blocks[index];
      return { ...visual, rhythmIndex: 0, effective: effectiveBlock({ ...block, modulations: [] }), muted: block.mute };
    }
    return visual;
  };

  const connections = useMemo(() => connectionsFor(patch), [patch]);
  const basePatch = variations[0]?.patch ?? patch;
  const blockVariationChanges = useMemo(() => patch.blocks.map((block, index) => activeVariation === 0 ? new Set<keyof SequencerBlock>() : changedBlockFields(block, basePatch.blocks[index])), [activeVariation, basePatch, patch.blocks]);
  const voiceVariationChanges = useMemo(() => Object.fromEntries(VOICE_DEFS.map(({ id }) => [id, activeVariation === 0 ? new Set<keyof VoiceState>() : changedVoiceFields(patch.voices[id], basePatch.voices[id])])) as Record<VoiceId, Set<keyof VoiceState>>, [activeVariation, basePatch, patch.voices]);
  const allSettingsLocked = randomizationLocks.every((blockLocks) => Object.values(blockLocks).every(Boolean));
  const allVoicesMuted = Object.values(patch.voices).every((voice) => voice.mute);
  const currentSongPart = songParts[activeSongPart] ?? songParts[0];

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

  const renderCard = (index: number, showDial = true, key?: string) => <SequencerCard key={key} showDial={showDial} index={index} block={patch.blocks[index]} blocks={patch.blocks} connections={connections} visual={visualFor(index)} patchOpen={showDial && openPatch === index} related={showDial && openPatch !== null && connections.some((connection) => (connection.source === openPatch && connection.target === index) || (connection.target === openPatch && connection.source === index))} locks={randomizationLocks[index]} changedFields={blockVariationChanges[index]} onPatchOpen={showDial ? setOpenPatch : () => document.getElementById("circle-routing")?.scrollIntoView({ behavior: "instant", block: "nearest" })} onChange={(next) => updateBlock(index, next)} onRandomize={() => updateBlock(index, randomizeBlock(patch.blocks[index], index, randomizationLocks[index]))} onLockToggle={() => setBlockLocks(index, !Object.values(randomizationLocks[index]).every(Boolean))} onParameterRandomize={(parameter) => updateBlock(index, randomizeBlockParameter(patch.blocks[index], index, parameter))} onParameterLockToggle={(parameter) => toggleParameterLock(index, parameter)} />;

  return (
    <div className="instrument">
      <InstrumentHeader playing={playing} observeOutput={engine.observeOutput} canUndo={history.past.length > 0} canRedo={history.future.length > 0} onUndo={undo} onRedo={redo} />

      <section className="transport-bar" aria-label="Transport and global controls">
        <div className="play-controls"><button aria-label={playing ? "Stop" : "Play"} className={cn("play-button", playing && "playing")} onClick={() => void togglePlayback()}>{playing ? <Square size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}{playing ? "Stop" : "Play"}<kbd>space</kbd></button><button className="reset-button" onClick={() => engine.reset()} aria-label="Reset all blocks" title="Reset every block to step 1"><RotateCcw size={16} /></button></div>
        <div className="tempo-section"><span className="eyebrow">Tempo</span><TempoControl value={patch.bpm} onChange={(value) => updateGlobal("bpm", value)} /></div>
        <div className="clock-section"><span className="eyebrow">Clock division</span><div className="rate-options">{RATE_OPTIONS.map((option) => <button key={option.value} aria-pressed={patch.rate === option.value} onClick={() => updateGlobal("rate", option.value)}>{option.label}</button>)}</div></div>
        <div className="global-range"><LabeledRange label="Swing" min={0} max={70} value={patch.swing} display={`${patch.swing}%`} onChange={(value) => updateGlobal("swing", value)} /></div>
        <div className="global-range master-range"><LabeledRange label="Master" min={0} max={100} value={patch.vol} display={`${patch.vol === 0 ? "−∞" : Math.round(20 * Math.log10(volumeGain(patch.vol)))} dB`} onChange={(value) => updateGlobal("vol", value)} /></div>
        <EffectsMixer value={patch.effects} baseValue={activeVariation > 0 ? basePatch.effects : undefined} bpm={patch.bpm} onChange={updateEffects} />
        <SessionPresetControls arrangement={currentArrangement} onApply={applyArrangement} onExport={() => setExportOpen(true)} />
      </section>

      <main className="workspace">
        <section className="sequencer-section" aria-label="Sequencer blocks">
          <div className="section-heading pattern-heading">
            <div className="pattern-title"><h2>Pattern {view === "grid" ? "grid" : "circle"}</h2><div className="view-switch" role="group" aria-label="Pattern view">{(["grid", "circle"] as const).map((mode) => <button type="button" key={mode} aria-pressed={view === mode} onClick={() => switchPatternView(mode)}>{mode === "grid" ? "Grid" : "Circle"}</button>)}</div><span className="section-meta">16 independent sequences</span></div>
            <div className="variation-toolbar">
              <button type="button" className="song-mode-button" aria-pressed={songMode} onClick={toggleSongMode} title={songMode ? "Edit patterns" : "Arrange and play the song"}><ListMusic size={12} />Song</button>
              {songMode ? <>
                <div className="variation-tabs song-timeline" role="group" aria-label="Song arrangement">
                  {songParts.map((part, index) => {
                    const variation = variations.find((candidate) => candidate.id === part.variationId);
                    if (!variation) return null;
                    const selected = activeSongPart === index;
                    return <button
                      type="button"
                      draggable
                      key={part.id}
                      aria-current={selected ? "true" : undefined}
                      aria-label={`Song part ${index + 1}: pattern ${variation.name}, ${part.bars} ${part.bars === 1 ? "bar" : "bars"}`}
                      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                      className={cn("song-part", selected && "is-selected", draggedSongPart === part.id && "is-dragging")}
                      style={{ flexBasis: `${32 + part.bars * 7}px` }}
                      onClick={() => selectSongPart(index)}
                      onKeyDown={(event) => {
                        if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
                        event.preventDefault();
                        selectSongPart(index, false);
                        moveActiveSongPartBy(event.key === "ArrowLeft" ? -1 : 1);
                      }}
                      onDragStart={(event) => {
                        setDraggedSongPart(part.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", part.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        moveSongPart(draggedSongPart ?? event.dataTransfer.getData("text/plain"), part.id);
                        setDraggedSongPart(null);
                      }}
                      onDragEnd={() => setDraggedSongPart(null)}
                      title="Drag to arrange · Alt + arrow keys to move"
                    ><GripVertical size={9} aria-hidden="true" /><span>{variation.name}</span><small>{part.bars}</small></button>;
                  })}
                  <button type="button" className="add-variation add-song-part" aria-label={`Add pattern ${variations[activeVariation].name} to song`} onClick={addSongPart} title="Add the selected pattern again"><Plus size={12} /></button>
                </div>
                <div className="repeat-control" aria-label={`Length for song part ${activeSongPart + 1}`}>
                  <button type="button" onClick={() => changeSongPartBars(-1)} disabled={currentSongPart.bars <= 1} aria-label="Shorten song part"><Minus size={10} /></button>
                  <output>{currentSongPart.bars}<span className="repeat-unit"> {currentSongPart.bars === 1 ? "bar" : "bars"}</span></output>
                  <button type="button" onClick={() => changeSongPartBars(1)} disabled={currentSongPart.bars >= 16} aria-label="Lengthen song part"><Plus size={10} /></button>
                </div>
                {songParts.length > 1 && <button type="button" className="delete-variation" aria-label={`Delete song part ${activeSongPart + 1}`} onClick={deleteSongPart} title="Remove this part from the song"><Trash2 size={11} /></button>}
              </> : <>
                <div className="variation-tabs" role="tablist" aria-label="Pattern variations">
                  {variations.map((variation, index) => {
                    const changed = index > 0 && variationHasChanges(variation, variations[0]);
                    return <button type="button" role="tab" key={variation.id} aria-selected={activeVariation === index} aria-label={`Variation ${variation.name}`} className={cn(changed && "has-changes")} onClick={() => selectPattern(index)} title={changed ? `Variation ${variation.name} has changes from A` : `Variation ${variation.name}`}><span>{variation.name}</span></button>;
                  })}
                  <button type="button" className="add-variation" aria-label="Add variation" onClick={addVariation} disabled={variations.length >= MAX_VARIATIONS} title="Duplicate the current variation"><Plus size={12} /></button>
                </div>
                {activeVariation > 0 && <button type="button" className="delete-variation" aria-label={`Delete variation ${variations[activeVariation].name}`} onClick={deleteVariation} title="Delete selected variation"><Trash2 size={11} /></button>}
              </>}
            </div>
            <div className="grid-actions"><button onClick={() => applyPatch(shufflePatch(patch, Math.random, randomizationLocks))} title="Shuffle unlocked settings, preserving routing" disabled={allSettingsLocked}><Dices size={13} />Shuffle</button><button className="lock-all-button" aria-pressed={allSettingsLocked} onClick={() => setRandomizationLocks(createRandomizationLocks(!allSettingsLocked))} title={allSettingsLocked ? "Unlock every pattern setting" : "Lock every pattern setting"}>{allSettingsLocked ? <Lock size={12} /> : <LockOpen size={12} />}{allSettingsLocked ? "Unlock all" : "Lock all"}</button><button onClick={() => applyPatch(createEmptyPatch(patch.vol))}><Eraser size={13} />Clear</button></div>
          </div>
          {view === "grid" ? <><div className="cable-controls">
            <button type="button" className="cable-toggle" role="switch" aria-checked={showCables} onClick={() => setShowCables((current) => !current)}><Cable size={13} />Patch cables<span className="toggle-track" aria-hidden="true"><i /></span></button>
            {showCables && <span className="cable-legend">{CABLE_SIGNALS.map((signal) => <span key={signal.input}><i style={{ background: signal.color }} />{signal.input}</span>)}</span>}
            {showCables && <span className="cable-hint">Hover a block to see through cables</span>}
          </div>
          <div className={cn("sequencer-grid", showCables && "cables-visible")}>
            {BLOCK_SLOTS.map(({ index, key }) => renderCard(index, true, key))}
          </div>
          </> : <OrbitView blocks={patch.blocks} visuals={patch.blocks.map((_block, index) => visualFor(index))} clockPulse={playing ? snapshot.clockPulse : -1} selected={selectedRhythm} onSelect={selectRhythm} />}
          <div className="grid-legend"><span><i className="legend-dot" /> Hit <i className="legend-dot hollow" /> Rest <i className="legend-dot accent" /> Playhead</span><span><Cable size={12} />{connections.length} block connections · Select Patch to trace a signal</span></div>
        </section>
        <aside className={cn("side-panel", view === "circle" && "circle-side-panel", openPatch !== null && "patch-visible")}>
          {view === "circle" && <div className="circle-panel-switch" role="group" aria-label="Circle sidebar"><button type="button" aria-pressed={circlePanel === "rhythm"} onClick={() => setCirclePanel("rhythm")}>Rhythm settings</button><button type="button" aria-pressed={circlePanel === "voices"} onClick={() => setCirclePanel("voices")}>Voice bank</button></div>}
          {view === "circle" && circlePanel === "rhythm" ? <div className="circle-inspector" role="region" aria-label={`Settings for block ${String(selectedRhythm + 1).padStart(2, "0")}`}>
            <div className="circle-inspector-title"><span className="eyebrow">Selected rhythm / {String(selectedRhythm + 1).padStart(2, "0")}</span><p>One ring, one rhythm. Adjust it here.</p></div>
            {renderCard(selectedRhythm, false)}
            <div id="circle-routing"><PatchPanel visual={visualFor(selectedRhythm)} voice={blockVoiceState(patch, selectedRhythm)} embedded index={selectedRhythm} blocks={patch.blocks} onChange={(next) => updateBlock(selectedRhythm, next)} onSelect={selectRhythm} onClose={() => undefined} /></div>
          </div> : <>

          {openPatch !== null ? <PatchPanel visual={visualFor(openPatch)} voice={blockVoiceState(patch, openPatch)} index={openPatch} blocks={patch.blocks} connections={connections} onChange={(next) => updateBlock(openPatch, next)} onSelect={setOpenPatch} onClose={() => setOpenPatch(null)} /> : <><div className="section-heading voice-bank-heading"><div><h2>Voice bank</h2><span className="section-meta">14 voices</span></div><button className="voice-bank-master" aria-pressed={allVoicesMuted} onClick={() => setAllVoicesMuted(!allVoicesMuted)}>{allVoicesMuted ? <Volume2 size={12} /> : <VolumeX size={12} />}{allVoicesMuted ? "Unmute all" : "Mute all"}</button></div><VoiceBank voices={patch.voices} blocks={patch.blocks} connections={connections} lfoValues={playing ? snapshot.blocks.map((block) => block.lfo) : patch.blocks.map(() => 0.5)} activeVoices={snapshot.activeVoices} changedFields={voiceVariationChanges} onChange={updateVoice} /><div className="voice-bank-note"><span className="jack" />808 / 909 / CST · 303 + 101 synths</div></>}
          </>}
        </aside>
        {view === "grid" && showCables && <PatchCables connections={connections} />}
      </main>
      <footer className="instrument-footer"><span><kbd>space</kbd> play / stop</span><span><kbd>↑</kbd> <kbd>↓</kbd> or drag to adjust · <kbd>shift</kbd> for larger steps</span><a className="footer-copyright" href="https://fredibach.com">(c) 2026 Fredi Bach</a><span className="footer-signoff">RHYTHM, BY DESIGN. <span>EG–16</span></span></footer>
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
  const inputId = useId();
  return (
    <div className="labeled-range">
      <label htmlFor={inputId}>{label}</label><output className="font-mono text-ink">{display}</output>
      <input id={inputId} className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
