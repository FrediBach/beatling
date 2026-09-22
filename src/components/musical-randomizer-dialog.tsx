import { useState } from "react";
import type { SequencerEngine } from "@/audio/engine";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useMusicalRandomizer } from "@/hooks/use-musical-randomizer";
import { usePatchAudition } from "@/hooks/use-patch-audition";
import type { BlockRandomizationLocks, Patch } from "@/lib/types";
import { MusicalCharacter, MusicalDirection } from "./musical-randomizer-questions";
import { MusicalPreview } from "./musical-randomizer-preview";

export interface MusicalRandomizerProps {
  patch: Patch;
  variationId: string;
  locks: BlockRandomizationLocks[];
  engine: SequencerEngine;
  onPause: () => void;
  onApply: (patch: Patch, source: Patch, variationId: string) => boolean;
}

const PAGES = ["Direction", "Character", "Listen"] as const;

export function MusicalRandomizerDialog({ patch, variationId, locks, engine, onPause, onApply, onClose }: MusicalRandomizerProps & { onClose: () => void }) {
  const { state, dispatch, candidate, stale, generate } = useMusicalRandomizer(patch, variationId, locks);
  const audition = usePatchAudition(engine, onPause);
  const [commitError, setCommitError] = useState("");
  const stopAnd = (action: () => void) => { audition.stop(); action(); };
  const apply = () => {
    if (!candidate || stale) return;
    audition.stop();
    if (onApply(candidate.patch, state.source, state.variationId)) onClose();
    else setCommitError("The source patch changed. Refresh before applying this groove.");
  };
  const questions = { request: state.request, source: state.source, onChange: (request: typeof state.request) => dispatch({ type: "request", request }) };
  const error = state.error || audition.error || commitError;
  const next = () => {
    if (state.page === 0) dispatch({ type: "page", page: 1 });
    else if (state.page === 1) generate();
    else apply();
  };
  return <DialogContent className="musical-dialog" onKeyDown={(event) => event.stopPropagation()}>
    <header><span className="eyebrow">Guided composition</span><DialogTitle>Musical randomizer</DialogTitle><DialogDescription>A few choices, a shared musical direction, and room for surprise. Nothing is saved until you Apply.</DialogDescription></header>
    <ol className="musical-progress" aria-label="Randomizer steps">{PAGES.map((name, index) => <li key={name} aria-current={state.page === index ? "step" : undefined}><span>{index + 1}</span>{name}</li>)}</ol>
    {stale && <div role="alert" className="musical-alert">The current variation or patch changed. Refresh to work from the latest version.<Button type="button" variant="outline" onClick={() => stopAnd(() => { dispatch({ type: "refresh", source: patch, variationId }); setCommitError(""); })}>Refresh source</Button></div>}
    <div className="musical-dialog-body">
      {state.page === 0 && <MusicalDirection {...questions} />}
      {state.page === 1 && <MusicalCharacter {...questions} />}
      {state.page === 2 && candidate && <MusicalPreview candidate={candidate} candidates={state.candidates} selected={state.selected} onSelect={(index) => stopAnd(() => dispatch({ type: "select", index }))} playing={audition.playing} onPlay={() => void audition.play(candidate.patch)} onStop={audition.stop} onReroll={() => stopAnd(generate)} />}
      {error && <p role="alert" className="musical-alert">{error}</p>}
    </div>
    <MusicalFooter page={state.page} disabled={stale || !state.request.parts.length} onCancel={() => stopAnd(onClose)} onBack={() => stopAnd(() => dispatch({ type: "page", page: state.page === 2 ? 1 : 0 }))} onNext={next} />
  </DialogContent>;
}

function MusicalFooter({ page, disabled, onCancel, onBack, onNext }: { page: number; disabled: boolean; onCancel: () => void; onBack: () => void; onNext: () => void }) {
  return <footer className="musical-dialog-footer"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><div>
    {page > 0 && <Button type="button" variant="outline" onClick={onBack}>Back</Button>}
    <Button type="button" disabled={disabled} onClick={onNext}>{["Next: character", "Generate groove", "Apply groove"][page]}</Button>
  </div></footer>;
}
