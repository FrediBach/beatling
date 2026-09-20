# Beatling agent guide

These instructions apply to the whole repository. Read `docs/architecture.md` before changing application structure, state ownership, persistence, routing, or audio behavior.

## Working principles

- Preserve the instrument's behavior while improving it. Prefer small, reviewable changes over broad rewrites.
- Inspect the relevant implementation and tests before editing. Treat tool findings as hypotheses, then confirm them in code.
- Keep the working tree intact: do not discard unrelated changes or rewrite user-owned work.
- Do not add features to `Euclidean Grid Sequencer.html`. It is a preserved prototype and is not part of the Vite application.
- Keep dependencies purposeful. Production code belongs in `dependencies`; build, test, and analysis tools belong in `devDependencies`.

## Architecture boundaries

- `src/lib/` is the pure domain layer. Keep rhythm math, normalization, routing derivation, presets, variation comparison, and serialization free of React and browser APIs where practical.
- `src/audio/engine.ts` owns Web Audio scheduling and synthesis. React may command the engine and render snapshots, but timing-critical work must not depend on React render cadence.
- `src/components/` renders UI and emits typed user intent through props. Components must not mutate patches or voices in place.
- `src/App.tsx` is the current composition root. Do not add another workflow directly to it: extract a focused component or hook first. The intended decomposition is recorded in `docs/architecture.md`.
- `src/hooks/` contains reusable interaction adapters. Hooks must clean up global listeners, animation frames, timers, and audio-related subscriptions.

## Required quality checks

Run the smallest relevant test while developing, then run the complete gate before handing off a code change:

```sh
npm run quality
```

The individual checks are:

```sh
npm run lint
npm test
npm run build
npm run doctor
```

React Doctor currently reports known structural warnings for the `App` and `SequencerCard` functions. Do not suppress them or add new warnings. When touching either area, prefer a behavior-preserving extraction that reduces the warning count. Explain any finding that cannot be resolved safely.

## React and accessibility rules

- Derive values during render or with `useMemo`; do not mirror derivable values into state.
- Use effects only to synchronize with browser, storage, or engine systems. Keep subscriptions stable and ensure cleanup is symmetrical.
- Use refs for mutable values read by scheduler callbacks, not as a substitute for render state.
- Use stable domain identities for list keys. Positional keys are acceptable only when the position is the documented identity of a fixed slot; expose that identity explicitly.
- Associate every form control with one accessible name. Do not wrap multiple native controls in one `label`.
- Preserve keyboard operation, focus restoration, pressed/current states, and reduced-motion-friendly behavior when changing controls.
- Avoid repeated array scans inside render loops. Build a `Set` or `Map` once when membership or lookup is repeated.

## Domain and audio invariants

- A patch has exactly `BLOCK_COUNT` sequencer slots. Slot index is its routing identity and is serialized in clock/reset/mute/modulation references.
- Keep pulses within the active step count and normalize imported or stored data at the boundary.
- Keep variation A as the comparison base and preserve independent history per variation.
- Browser storage is optional; failures must not make the instrument unusable.
- Create or resume the `AudioContext` only from a user action. Always stop timers and disconnect/close resources in engine teardown.
- Scheduler logic must remain bounded; preserve its guards against recursive routing and runaway queues.

## Tests and documentation

- Add or update Vitest coverage for behavior changes. Prefer user-visible assertions with Testing Library for components and deterministic unit tests for domain/audio logic.
- Mock browser or Web Audio boundaries narrowly. Avoid testing implementation details when an accessible UI outcome is available.
- Update `docs/architecture.md` when a module gains a new responsibility, a state owner moves, a persistence format changes, or a new external boundary is introduced.

