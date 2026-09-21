# Beatling architecture

## System overview

Beatling is a browser-only Euclidean drum instrument. It is a React and TypeScript single-page application built with Vite. There is no application server: patches and arrangements are stored in browser `localStorage`, Web Audio produces sound locally, and export/import happens in the client.

```text
User input
    │
    ▼
React UI (`src/components`, composed by `src/App.tsx`)
    │ typed intents                         ▲ render snapshots
    ├───────────────► Patch/arrangement state ───────────────┐
    │                         │                               │
    │                         ├──► localStorage               │
    │                         └──► export/import              │
    │                                                         │
    └────────────────────────► SequencerEngine ────────────────┘
                                  │
                                  ▼
                              Web Audio API

Pure domain modules in `src/lib` support both the UI and audio engine.
```

## Runtime entry points

- `index.html` provides the Vite page and React mount node.
- `src/main.tsx` mounts `App` under `StrictMode` and imports global styles.
- `src/App.tsx` is the composition root and current owner of session, arrangement, selection, history, theme, and engine coordination.
- `src/audio/engine.ts` is the imperative audio runtime. It schedules clock pulses ahead of playback time, synthesizes voices, and exposes display snapshots to React.
- `Euclidean Grid Sequencer.html` is a preserved pre-React prototype. It is not imported by the application, included in the production module graph, or a target for new development.

## Module responsibilities

| Area | Responsibility | Constraints |
| --- | --- | --- |
| `src/lib/types.ts` | Shared domain contracts and fixed block count | Must remain usable by UI, domain, export, and audio layers |
| `src/lib/euclid.ts` | Euclidean hit calculation, clamping, modulation, gain conversion | Pure and deterministic |
| `src/lib/patch.ts` | Patch defaults, normalization, randomization, patch persistence | Normalize untrusted storage/import data at this boundary |
| `src/lib/variations.ts` | Arrangement defaults, migrations, persistence, change detection | Preserve compatibility with versioned stored formats |
| `src/lib/routing.ts`, `cables.ts`, `orbit.ts` | Derived routing and visualization data | No React state or side effects |
| `src/lib/presets.ts`, `voice-config.ts`, `constants.ts` | Curated data and domain configuration | Keep source data separate from rendering |
| `src/audio/engine.ts` | Clock, routing evaluation, voice synthesis, runtime snapshots | Timing cannot depend on React renders; all loops stay bounded |
| `src/components/` | Accessible controls and visualizations | Receive data and typed callbacks; no in-place domain mutation |
| `src/hooks/` | Reusable browser interaction behavior | Own and clean up listeners created by the hook |
| `src/export/` | Serialization to external formats | Deterministic output with unit coverage |

The small components under `src/components/ui/` wrap reusable Radix primitives or styling variants. Feature components should depend on these primitives rather than reproduce dialog and button mechanics.

`SequencerRouting` renders compact input/output counts and connected cable anchors inside each card's existing fixed-height Patch footer. Voice rows expose the same counted modulation-input sockets and Patch action. Hover tooltips and accessible names describe the source, signal, and destination of every route. Only assigned ports are rendered, and modulation destinations have separate cable anchors. `PatchCables` measures block and voice anchors across the workspace without owning routing state.

`EffectsDialog` owns only the selected processor tab. Its editor and per-voice send controls emit immutable effect updates through the existing patch history. `EffectControl` owns transient numeric-entry drafts and pointer gestures (vertical dial dragging, Shift fine adjustment, and reset); committed values remain in the patch. Bypass preserves parameters and sends. These controls do not create audio resources or change routing semantics.

## State model and data flow

`Patch` is the playable unit. It contains global transport values, 16 fixed sequencer blocks, the voice bank, and shared effect configuration with per-voice send levels. A block's array index is also its routing address, which is why slots have stable positional identities even when their contents change.

`Arrangement` owns:

- variations, each with a complete patch;
- song parts, which reference variations by ID and define bar counts;
- the active variation and song part;
- whether song playback mode is enabled.

`App` keeps declarative state for rendering and mirrors selected values into refs for the engine's long-lived callbacks. Patch edits are immutable and pass through a bounded per-variation undo history. Each accepted patch is sent to `SequencerEngine`, reflected in the active variation, and persisted after a short debounce.

During playback, the engine is authoritative for timing. React requests a lightweight snapshot on each animation frame to draw playheads, firing states, modulation, and active voice LEDs. UI rendering never schedules audio events.

## Persistence and compatibility

Two versioned local-storage records currently exist:

- `egs.patch.v5` for the latest patch;
- `egs.arrangement.v5` for variations and song structure.

All reads are defensive. `normalizePatch` and `normalizeArrangement` supply defaults, constrain values, and migrate v1 patches to silent default effect sends as well as the older variation-repeat representation into song parts. The v5 readers fall back through v4, v3, v2, and v1 storage keys so existing sessions migrate on their next save. Patch v3 replaced the single `modSrc` / `modDst` / `modAmt` tuple with `modulations`, an array of independently sourced and scaled routes. Patch v4 adds an explicit block kind and two normalized voice destinations for Bernoulli gates; older blocks infer voice or Modulator kind from their voice assignment. Patch v5 adds normalized modulation routes to each shared voice. Each modulation destination is a stable route identity and occurs at most once per receiving block or voice. Legacy tuples migrate to one block route; an explicitly empty modern array stays empty. Normalization rejects invalid/self block sources and duplicate destinations, clamps depths, and strips legacy fields. Arrangement v5 carries these patches, with unchanged song-part semantics. Storage access remains wrapped in `try/catch` because privacy settings and quota failures must degrade to an in-memory session.

Changing either serialized shape requires a new format decision, migration coverage, and backward-compatibility tests. Do not silently reinterpret existing fields.

## Audio lifecycle

`SequencerEngine` exists once per mounted application. The engine delays `AudioContext` creation until playback begins, satisfying browser gesture policies. It uses a short look-ahead scheduler for sound and queues visual events for snapshot consumption. `destroy()` is called when the app unmounts.

Each voice has a persistent dry bus plus gain-controlled sends into four shared returns: distortion, convolution reverb, filtered feedback delay, and parallel compression. The returns feed the existing master compressor. Effect parameter updates are smoothed on the audio timeline and do not depend on React render timing.

`src/lib/modulation.ts` owns block and voice route normalization, target labels, and displayed target values. `effectiveBlock` resolves per-hit block routes, while `effectiveVoiceModulation` resolves routes attached to the shared voice bank. The engine samples both at the scheduled hit time and combines their normalized tune, decay, and level offsets before synthesis. Both audio scheduling and the UI use these domain contracts. Engine visual events include the full effective block values; voice readouts use the audible LFO snapshots and show editable base values while stopped.

`ModulationEditor` emits immutable block updates through the existing variation history and explains setup, depth scaling, and clock behavior. `ModulationScope` draws the Euclidean hit markers and the waveform with a snapshot-driven cursor. Its random trace is explicitly an illustrative preview; the cursor shows the live value. Neither component owns a timer or schedules audio. `SequencerHeading` and the routing strip render the card’s header and connections. `SequencerParameters` owns the extracted parameter controls and displays assigned depths alongside base and effective values. Voice targets display their per-block results in the routing panel, since several blocks may share one voice bank entry. Lua export serializes every rhythm target; browser-only voice targets retain an explicit export comment.

Modulator blocks (`kind === "modulator"`) use Mod Medusa-style Euclidean cycle timing: every filled step begins a complete waveform cycle, lasting until the next filled step, including across the pattern boundary. Steps, Fill, Rotate and effective Divide all affect this timing. `src/lib/lfo.ts` locates the enclosing interval with bounded searches and samples immutable clock anchors. Each anchor stores its effective rhythm, waveform, random value, audio time, and expected step duration. The scheduler samples those anchors at the target event time; snapshots consume separate queued anchors before interpolating at audible time, so lookahead cannot make the scope run early. Interpolation uses the last incoming clock interval and division, and holds after one expected step if clocks stop. Irregular/routed clocks re-anchor on each accepted step. Fill 0 and an unstarted Modulator return the internal midpoint 0.5, giving zero bipolar modulation. Random chooses a new value at each Euclidean hit and holds it through the gap. Chance, mute, and gate length retain their trigger/gate-only behavior. Blocks with drum voices retain their original stepped, once-per-pattern LFO. Reset clears the clock anchor, and Lua export implements the same cycle sampling. Stored rhythm parameters drive Modulator waveforms.

The timing reference is the [Shakmat Mod Medusa manual](https://shakmat.com/doc/mm/MM-User_Manual.pdf), section “Sequencer.” Beatling retains its existing waveform choices and independent blocks; this is the Euclidean waveform-cycle behavior, not an emulation of the hardware's correlation modes, shape morphing, or auxiliary inputs.

Routing can feed block outputs into other block clocks, resets, mutes, and modulation inputs. Queue and per-block guards prevent cyclic patches from producing unbounded work. Any routing change must retain those guards and add focused tests.

Bernoulli gate blocks are silent two-way voice routers. Every accepted input clock advances the block's Euclidean pattern. On a filled position, Chance is the probability of playing voice A; the complementary probability plays voice B, so a Euclidean hit is never discarded. Divide reduces how often the router advances, while mute/mute input suppress both branches. The selected event remains the block's trigger and gate output for downstream routing. Both voices use the shared voice bank and the block's per-hit voice modulation. Lua export preserves the Euclidean trigger pattern but marks the browser-only voice split explicitly.

## Quality strategy

- ESLint enforces TypeScript, hooks, and refresh-safe module rules.
- Vitest covers domain logic, export, the audio engine, and user-visible React flows.
- TypeScript plus the Vite production build checks module boundaries and bundling.
- React Doctor scans React correctness, accessibility, performance, and maintainability through `npm run doctor`.
- `npm run quality` runs the complete local gate.

`doctor.config.ts` excludes only the standalone prototype because it is outside the shipped application. Findings in production source should be fixed at their cause rather than hidden in configuration.

## Current pressure points and direction

`App.tsx` still coordinates several distinct workflows and is the largest maintenance risk. New work should gradually extract these seams without changing state semantics:

1. A session hook for patch history, active variation switching, and persistence.
2. An arrangement hook for song-part selection, ordering, and bar advancement.
3. Focused header/transport, pattern-toolbar, sequencer-workspace, and inspector components.
4. A small controller interface between those hooks/components and `SequencerEngine`.

`SequencerCard` is the second pressure point. Its heading, pattern visualization, parameter list, and routing summary can become focused children with explicit props. Prefer these extractions when touching the card instead of extending its conditional JSX.

The migration should remain incremental: preserve current tests, add coverage around each extracted seam, and keep React Doctor's warning count from increasing.
