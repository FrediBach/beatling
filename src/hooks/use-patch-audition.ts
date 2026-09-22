import { useCallback, useEffect, useRef, useState } from "react";
import type { SequencerEngine } from "@/audio/engine";
import type { Patch } from "@/lib/types";

export function usePatchAudition(engine: SequencerEngine, onPause: () => void) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const stop = useCallback(() => {
    requestRef.current += 1;
    engine.endAudition();
    setPlaying(false);
  }, [engine]);
  const play = async (patch: Patch) => {
    stop();
    const request = ++requestRef.current;
    setError("");
    onPause();
    engine.beginAudition(patch);
    setPlaying(true);
    try {
      await engine.start();
      if (request === requestRef.current) setPlaying(engine.running && engine.auditioning);
    } catch {
      if (request === requestRef.current) {
        stop();
        setError("Audio preview could not start. Try Play preview again.");
      }
    }
  };
  useEffect(() => () => {
    requestRef.current += 1;
    engine.endAudition();
  }, [engine]);
  return { playing, error, play, stop };
}
