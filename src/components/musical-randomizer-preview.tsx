import { useMemo } from "react";
import { voiceName } from "@/lib/constants";
import { musicalEvents } from "@/lib/musical-randomizer/evaluate";
import type { MusicalCandidate } from "@/lib/musical-randomizer/types";
import type { VoiceId } from "@/lib/types";
import { Button } from "@/components/ui/button";

const STEPS = Array.from({ length: 16 }, (_, pulse) => ({ pulse, id: `pulse-${pulse}` }));

export function MusicalPreview({ candidate, candidates, selected, onSelect, playing, onPlay, onStop, onReroll }: {
  candidate: MusicalCandidate; candidates: MusicalCandidate[]; selected: number; onSelect: (index: number) => void;
  playing: boolean; onPlay: () => void; onStop: () => void; onReroll: () => void;
}) {
  const lanes = useMemo(() => {
    const events = musicalEvents(candidate.patch, 1);
    const hitsByVoice = new Map<VoiceId, Set<number>>();
    for (const event of events) {
      const hits = hitsByVoice.get(event.voice) ?? new Set<number>();
      hits.add(event.pulse);
      hitsByVoice.set(event.voice, hits);
    }
    return [...hitsByVoice].map(([voice, hits]) => ({ voice, hits }));
  }, [candidate.patch]);
  return <section className="musical-preview" aria-label="Generated groove">
    <p className="musical-summary">{candidate.summary}</p>
    <p className="musical-note">Changed: {candidate.changedParts.map(voiceName).join(", ") || "global settings"}.</p>
    <div className="musical-pattern" aria-label="First bar of direct rhythms">{lanes.map(({ voice, hits }) => <div className="musical-lane" key={voice}>
      <span>{voiceName(voice)}</span><div role="img" aria-label={`${voiceName(voice)} first bar: hits on steps ${[...hits].map((pulse) => pulse + 1).join(", ")}`}>
        {STEPS.map(({ pulse, id }) => <i key={id} className={hits.has(pulse) ? "is-hit" : ""} />)}
      </div>
    </div>)}</div>
    <p className="musical-note">First bar shown. Routed or divided parts are heard in preview but are not plotted.</p>
    <div className="musical-listen-actions"><Button type="button" onClick={playing ? onStop : onPlay}>{playing ? "Stop preview" : "Play preview"}</Button><Button type="button" variant="outline" onClick={onReroll}>Try another</Button></div>
    <p className="musical-note">Preview pauses the instrument and song. Closing restores your patch and leaves playback stopped.</p>
    {candidates.length > 1 && <fieldset className="musical-choice"><legend>Recent ideas</legend><div>{candidates.map((item, index) => <button type="button" key={item.seed} aria-pressed={selected === index} onClick={() => onSelect(index)}>Idea {index + 1}</button>)}</div></fieldset>}
    {candidate.notices.length > 0 && <ul className="musical-notices">{candidate.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>}
    <small className="musical-seed">Seed {candidate.seed} · generator v{candidate.version}</small>
  </section>;
}
