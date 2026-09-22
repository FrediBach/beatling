import { useReducer } from "react";
import { generateMusicalPatch } from "@/lib/musical-randomizer/generate";
import { defaultRequest, type MusicalCandidate, type MusicalRequest } from "@/lib/musical-randomizer/types";
import type { BlockRandomizationLocks, Patch } from "@/lib/types";

interface Session {
  source: Patch;
  variationId: string;
  request: MusicalRequest;
  page: 0 | 1 | 2;
  candidates: MusicalCandidate[];
  selected: number;
  seed: number;
  error: string;
}
type Action = { type: "request"; request: MusicalRequest } | { type: "page"; page: Session["page"] } | { type: "select"; index: number } | { type: "generated"; candidate?: MusicalCandidate; error?: string; seed: number } | { type: "refresh"; source: Patch; variationId: string };

function reducer(state: Session, action: Action): Session {
  switch (action.type) {
    case "request": return { ...state, request: action.request, candidates: [], selected: 0, error: "" };
    case "page": return { ...state, page: action.page, error: "" };
    case "select": return { ...state, selected: action.index, error: "" };
    case "refresh": return { ...state, source: action.source, variationId: action.variationId, page: 0, candidates: [], selected: 0, request: defaultRequest(action.source, state.request.mode), error: "" };
    case "generated": {
      if (!action.candidate) return { ...state, error: action.error ?? "No candidate could be generated.", seed: action.seed };
      const candidates = [...state.candidates, action.candidate].slice(-6);
      return { ...state, candidates, selected: candidates.length - 1, page: 2, seed: action.seed, error: "" };
    }
  }
}

export function useMusicalRandomizer(source: Patch, variationId: string, locks: BlockRandomizationLocks[]) {
  const [state, dispatch] = useReducer(reducer, { source, variationId, request: defaultRequest(source), page: 0, candidates: [], selected: 0, seed: 0, error: "" });
  const candidate = state.candidates[state.selected];
  const stale = state.source !== source || state.variationId !== variationId;
  const generate = () => {
    const seed = state.seed ? (state.seed + 1) >>> 0 : Math.floor(Math.random() * 0xffffffff) || 1;
    const result = generateMusicalPatch(state.source, state.request, seed, locks, candidate?.patch);
    dispatch({ type: "generated", ...result, seed });
  };
  return { state, dispatch, candidate, stale, generate };
}
