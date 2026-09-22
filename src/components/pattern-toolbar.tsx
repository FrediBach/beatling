import { useState } from "react";
import { Dices, Eraser, Lock, LockOpen, Music2 } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { MusicalRandomizerDialog, type MusicalRandomizerProps } from "./musical-randomizer-dialog";

interface PatternToolbarProps extends MusicalRandomizerProps {
  allLocked: boolean;
  onShuffle: () => void;
  onToggleLocks: () => void;
  onClear: () => void;
}

export function PatternToolbar({ allLocked, onShuffle, onToggleLocks, onClear, ...randomizer }: PatternToolbarProps) {
  const [open, setOpen] = useState(false);
  return <div className="grid-actions">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button type="button" title="Compose a groove from musical choices"><Music2 size={13} />Musical randomizer</button></DialogTrigger>
      {open && <MusicalRandomizerDialog {...randomizer} onClose={() => setOpen(false)} />}
    </Dialog>
    <button type="button" onClick={onShuffle} title="Shuffle unlocked settings, preserving routing" disabled={allLocked}><Dices size={13} />Shuffle</button>
    <button type="button" className="lock-all-button" aria-pressed={allLocked} onClick={onToggleLocks} title={allLocked ? "Unlock every pattern setting" : "Lock every pattern setting"}>{allLocked ? <Lock size={12} /> : <LockOpen size={12} />}{allLocked ? "Unlock all" : "Lock all"}</button>
    <button type="button" onClick={onClear}><Eraser size={13} />Clear</button>
  </div>;
}
