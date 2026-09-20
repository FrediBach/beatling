import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { Dices, Download, Eraser, Moon, Play, RotateCcw, Square, Sun } from "lucide-react";
import { SequencerEngine } from "@/audio/engine";
import { ExportDialog } from "@/components/export-dialog";
import { SequencerCard } from "@/components/sequencer-card";
import { Button } from "@/components/ui/button";
import { VoiceBank } from "@/components/voice-bank";
import { RATE_OPTIONS } from "@/lib/constants";
import { effectiveBlock, volumeGain } from "@/lib/euclid";
import { createDemoPatch, createEmptyPatch, loadStoredPatch, savePatch, shufflePatch } from "@/lib/patch";
import type { BlockVisualState, EngineSnapshot, Patch, SequencerBlock, VoiceId, VoiceState } from "@/lib/types";
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
  const [patch, setPatchState] = useState<Patch>(model.initialPatch);
  const setPatch = useCallback((action: SetStateAction<Patch>) => {
    setPatchState((current) => {
      const next = typeof action === "function" ? action(current) : action;
      model.source.patch = next;
      return next;
    });
  }, [model]);
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(patch));
  const [playing, setPlaying] = useState(false);
  const [openPatch, setOpenPatch] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const timeout = window.setTimeout(() => savePatch(patch), 250);
    return () => window.clearTimeout(timeout);
  }, [patch]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      event.preventDefault();
      void togglePlayback();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback]);

  const updateGlobal = <K extends keyof Pick<Patch, "bpm" | "rate" | "swing" | "vol">>(key: K, value: Patch[K]) => {
    setPatch((current) => ({ ...current, [key]: value }));
    if (key === "vol") engine.setVolume(value);
  };

  const updateBlock = (index: number, block: SequencerBlock) => {
    setPatch((current) => ({ ...current, blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? block : item) }));
  };

  const updateVoice = (id: VoiceId, voice: VoiceState) => {
    setPatch((current) => ({ ...current, voices: { ...current.voices, [id]: voice } }));
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

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-3">
        <h1 className="text-[17px] font-semibold tracking-tight">Euclidean Grid Sequencer</h1>
        <p className="text-xs text-muted">16 clocked blocks, three outputs each, patched into an 808/909 drum voice bank.</p>
        <span className="flex-1" />
        <a className="border-b border-rule text-xs text-muted hover:border-ink hover:text-ink" href="https://www.luading.dev/" target="_blank" rel="noreferrer">Luading</a>
        <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </Button>
      </header>

      <main className="grid flex-1 grid-cols-[214px_minmax(0,1fr)_258px] max-[1180px]:grid-cols-1">
        <aside className="flex flex-col gap-4 border-r border-rule p-3.5 max-[1180px]:grid max-[1180px]:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] max-[1180px]:items-start max-[1180px]:gap-x-5 max-[1180px]:border-b max-[1180px]:border-r-0">
          <ControlSection title="Transport">
            <div className="flex gap-1.5">
              <Button type="button" className={cn("flex-1", playing && "border-signal bg-signal text-white")} onClick={() => void togglePlayback()}>
                {playing ? <Square className="size-3" fill="currentColor" /> : <Play className="size-3" fill="currentColor" />}
                {playing ? "Stop" : "Play"}
              </Button>
              <Button type="button" variant="outline" onClick={() => engine.reset()} title="Reset every block to step 1"><RotateCcw className="size-3.5" />Reset</Button>
            </div>
          </ControlSection>

          <ControlSection title="Tempo">
            <TempoControl value={patch.bpm} onChange={(value) => updateGlobal("bpm", value)} />
          </ControlSection>

          <ControlSection title="Global clock">
            <div className="flex overflow-hidden rounded-sm border border-rule">
              {RATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn("flex-1 border-r border-rule bg-sheet py-1 font-mono text-[10px] text-muted last:border-r-0", patch.rate === option.value && "bg-ink text-paper")}
                  aria-pressed={patch.rate === option.value}
                  onClick={() => updateGlobal("rate", option.value)}
                >{option.label}</button>
              ))}
            </div>
            <LabeledRange label="Swing" min={0} max={70} value={patch.swing} display={`${patch.swing}%`} onChange={(value) => updateGlobal("swing", value)} />
          </ControlSection>

          <ControlSection title="Mix">
            <LabeledRange
              label="Master"
              min={0}
              max={100}
              value={patch.vol}
              display={`${patch.vol === 0 ? "-inf" : Math.round(20 * Math.log10(volumeGain(patch.vol)))} dB`}
              onChange={(value) => updateGlobal("vol", value)}
            />
          </ControlSection>

          <div className="h-px bg-rule-soft max-[1180px]:hidden" />

          <ControlSection title="Patch">
            <div className="flex flex-col gap-1.5">
              <RailButton label="Load demo" hint="16 blocks" onClick={() => applyPatch(createDemoPatch(patch.vol))} />
              <RailButton label="Shuffle patterns" hint="keeps routing" icon={<Dices className="size-3" />} onClick={() => applyPatch(shufflePatch(patch))} />
              <RailButton label="Clear all" hint="start empty" icon={<Eraser className="size-3" />} onClick={() => applyPatch(createEmptyPatch(patch.vol))} />
              <RailButton label="Export" hint=".lua / .json" icon={<Download className="size-3" />} onClick={() => setExportOpen(true)} />
            </div>
          </ControlSection>
        </aside>

        <section className="min-w-0 p-3.5" aria-label="Sequencer blocks">
          <div className="grid grid-cols-4 gap-2.5 max-[1460px]:grid-cols-[repeat(auto-fit,minmax(206px,1fr))]">
            {patch.blocks.map((block, index) => (
              <SequencerCard
                key={index}
                index={index}
                block={block}
                blocks={patch.blocks}
                visual={visualFor(index)}
                patchOpen={openPatch === index}
                onPatchOpen={setOpenPatch}
                onChange={(next) => updateBlock(index, next)}
              />
            ))}
          </div>
        </section>

        <aside className="border-l border-rule p-3.5 max-[1180px]:border-l-0 max-[1180px]:border-t">
          <h2 className="mb-2 text-[11px] font-semibold text-muted">Drum voices</h2>
          <VoiceBank voices={patch.voices} activeVoices={snapshot.activeVoices} onChange={updateVoice} />
        </aside>
      </main>

      <footer className="flex flex-wrap gap-4 border-t border-rule px-4 py-2.5 text-[11px] text-muted">
        <span><kbd>space</kbd> play / stop</span>
        <span>Drag a parameter row up or down to change it</span>
        <span>Clock, reset, mute and modulation inputs live under <kbd>patch</kbd></span>
      </footer>

      {exportOpen && <ExportDialog open onOpenChange={setExportOpen} patch={patch} onLoad={applyPatch} />}
    </div>
  );
}

function ControlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-[11px] font-semibold text-muted">{title}</h2>{children}</section>;
}

function TempoControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const clampedChange = (next: number) => onChange(Math.min(300, Math.max(20, Math.round(next))));
  const drag = useDragNumber({ value, onChange: clampedChange, sensitivity: 4 });
  return (
    <div className="flex touch-none cursor-ns-resize items-end gap-1.5 rounded-sm border border-rule bg-sheet px-2.5 py-1.5" {...drag}>
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
    <label className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-2 text-[11px] text-muted">
      {label}<output className="font-mono text-ink">{display}</output>
      <input className="range col-span-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function RailButton({ label, hint, icon, onClick }: { label: string; hint: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="w-full justify-between px-2.5" onClick={onClick}>
      <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-mono text-[9px] font-normal text-muted">{hint}</span>
    </Button>
  );
}
