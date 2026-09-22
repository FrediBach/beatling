# Musical randomizer implementation plan

Status: proposal; application implementation has not started.

## Product direction

Add **Musical randomizer** beside Shuffle. It asks a few musical questions and creates a coordinated groove with drums, bassline, and lead. Randomness chooses among musically compatible possibilities; a shared plan determines how the parts work together.

Confirmed scope:

- Support both **Create a new groove** and **Reshape this patch**, with an explicit choice.
- Include drums, bassline, and lead in the first release. Users can exclude individual parts.
- Keep the existing Shuffle and individual dice available.

The first release generates one playable patch with a repeating phrase. It uses Beatling's existing sequencer, synths, quantizer, and rhythm series. Full song arrangement generation, arbitrary note sequencing, new synthesis, and a server/AI dependency are separate future work.

## 1. The questions

Use a compact dialog with three pages: **Direction → Character → Listen**. Show sensible defaults, a Back button, and an editable summary. Avoid requiring music theory knowledge.

Start with the mode choice. Then ask five core questions:

| Question | Initial choices | Musical consequence |
| --- | --- | --- |
| What kind of groove? | Steady dance; broken beat; half-time; rolling percussion | Selects anchor patterns, backbeat placement, bass relationship, and supporting rhythm vocabulary. These are product profiles, not promises of exact genre emulation. |
| How much activity? | Spacious; balanced; busy | Changes supporting hit counts, number of percussion voices, bass activity, and lead phrase length. Does not simply turn every lane up. |
| How syncopated? | Grounded; some bounce; adventurous | Changes allowed offbeat positions and interaction between parts while retaining the chosen foundation. |
| What timing feel? | Straight; light swing; strong swing; keep current | Sets existing global swing. This does not imply human timing jitter or velocity humanization. |
| How much development? | Repeating loop; small changes; evolving phrase | Selects a one-, two-, or four-bar phrase and how much supporting material changes near its ending. |

Include a compact setup row with **Tempo**, **Parts**, and, when bass or lead is included, **Key and scale**. These are settings with defaults, not additional mandatory wizard steps.

- New groove: show the profile's proposed BPM as an editable value before generation. Default to drums + bass + lead and a visible shared key/scale.
- Reshape: keep BPM, rate, swing, existing parts, and tuning by default. Offer explicit controls to change them.
- Use the existing note names and supported scales. A beginner view can describe Major as bright, Natural minor as darker, and Minor pentatonic as simple/open, while retaining the actual scale name.
- If the existing synths have different tonal settings, show “Keep existing tuning” and offer “Use a shared key.” Do not silently retune them.
- In Reshape, add **Change amount: subtle / moderate / bold**. This controls distance from the original and is distinct from syncopation and phrase development.

Example brief: “Broken beat · balanced · some bounce · light swing · small changes · 112 BPM · D minor · drums, bass and lead.”

## 2. Define what each mode may change

| Area | Create a new groove | Reshape this patch |
| --- | --- | --- |
| Starting material | Fresh role-based composition, fitted around protected material | Current patch is the source and comparison baseline |
| Drum rhythms | Generate coordinated foundation and support | Modify selected eligible parts within the change budget |
| Bass and lead | Generate rhythm plus quantized pitch motion | Preserve sounds and tuning; optionally reshape compatible pitch motion |
| Sound settings | Choose bounded, authored sound/mix recipes | Preserve voice settings and effects unless explicitly opted in |
| Routing | Create a small, known routing layout in available slots | Preserve existing addresses, assignments, and routing |
| Tempo and timing | Use the displayed settings | Keep current unless explicitly changed |
| Other variations/song parts | Preserve | Preserve |

Locks remain meaningful in both modes:

- Existing parameter locks are hard constraints. A fully locked block remains unchanged.
- For new construction, a slot with any lock retains its identity, voice assignment, and routing; the generator fits around it. Do not move it to a different slot.
- Add a dialog-level **Keep this part** control. This protects all blocks contributing to the part, their rhythm series, and shared voice settings. It is broader than the existing parameter locks.
- Preserve dependencies of protected parts, including clock, reset, mute, block modulation, and shared voice modulation sources. Traverse with a visited set bounded by the 16 slots.
- Existing parameter locks currently cover Steps, Fill, Rotate, Divide, and Chance. They do not define locks for series, voice synthesis, or pitch routes; keep those intact by default in Reshape and explain the broader Keep control.
- If constraints prevent the requested result, show the specific limitation and offer a smaller change or explicit unlock. Never silently ignore a lock or claim success for an unchanged patch.

For an initial Reshape implementation, generate against supported global-clock voice blocks and known deterministic pitch configurations. Preserve complex routed/Bernoulli parts and their dependencies, and show which parts were left intact. Editing an upstream source can affect several audible parts, so eligibility must be based on routing dependencies, not only block kind.

## 3. Generate a musical plan before choosing parameters

The pure generator should follow this pipeline:

1. **Normalize the request.** Resolve defaults, mode, selected parts, protected fields, available slots, and phrase duration.
2. **Assign musical roles.** Find kick, backbeat, timekeeping, percussion, bass, lead, and pitch sources by voice and routing. A slot number is not a musical role. Group multiple blocks playing the same voice.
3. **Choose a foundation.** Select a curated anchor skeleton for the chosen profile. Critical kick/backbeat hits use 100% chance.
4. **Generate supporting rhythm candidates.** Choose compatible hats, percussion, bass onsets, and lead rests using density and syncopation targets.
5. **Generate pitch-motion candidates.** Select compatible bass and lead modulation recipes using a shared tonal brief and separate registers.
6. **Add phrase development.** Use rhythm series and repeats for small endings or answering phrases while retaining recognisable anchors.
7. **Fit the patch budget.** Allocate rhythms and modulators within exactly 16 slots, respecting reserved identities and dependencies.
8. **Evaluate and select.** Reject invalid candidates, score valid candidates, then make a seeded weighted choice among good results.
9. **Normalize and report.** Return the patch plus a user-readable explanation, changed-part summary, seed, generator version, and any unmet preferences.

Use a fixed search budget, initially up to 64 complete candidate plans, with bounded per-role catalogs. Tune that budget from profiling. Avoid unbounded rejection sampling or exhaustive search over arbitrary patches.

Hard constraints take precedence over scoring: valid patch, preserved locks, available slots, valid routing, requested part exclusions, and protected settings. Soft preferences include density, syncopation, repetition, space, and similarity to the source.

If no result satisfies the hard constraints, return a structured explanation. If several valid candidates exist, randomness should select between them rather than always taking the same highest-scoring pattern.

## 4. Musical rules for the first release

### Drums

- Keep a stable foundation appropriate to the selected profile. A half-time profile should not inherit a four-on-the-floor assumption.
- Add density primarily through hats, shakers, and secondary percussion before adding many low-frequency hits.
- Prefer complementary percussion placements, while allowing intentional kick/backbeat or snare/clap layering.
- Coordinate open and closed hats with existing choke behavior. Avoid unintended doubled triggers from multiple blocks assigned to the same voice.
- Leave some space in the phrase; do not make every active voice busy simultaneously.
- Keep generation randomness separate from playback probability. Start with deterministic hits; optional chance on ornamentation can come later.

### Bassline and lead

- Use the existing quantized V/Oct routes and supported scales. Bass and lead have separate pitch sources but share the selected tonal center in new grooves.
- Give bass an explicit relationship to the kick: reinforce selected hits or answer them on offbeats, depending on the profile.
- Prefer a small bass vocabulary and a short, recognisable lead motif with rests. Use different registers to make the two roles audible.
- Treat “same scale” as one constraint, not a complete musical quality test. Score interval movement, repetition, phrase endings, rhythmic overlap, and separation of registers.
- Generate deterministic ramp, triangle, and square modulation recipes. Random LFO shapes choose fresh values during playback and cannot promise a repeatable melody from a generation seed.
- Evaluate pitches at actual note onset times using the existing LFO and quantizer semantics. Account for source/target traversal order, first-note startup, swing, and series transitions; confirm results with engine-level tests.
- In new generated tonal parts, use neutral post-quantizer Tune and omit tune modulation unless a recipe explicitly accounts for it. Existing Tune is applied after scale quantization and can invalidate a naïve “all notes are in the chosen key” guarantee.
- Do not promise arbitrary note-by-note melodies: the current patch format expresses pitch through modulation. A small catalog of tested pitch-motion recipes is the first-release foundation.

### Phrase development and sound

- Repeating loop: a stable one-bar pattern.
- Small changes: a two-bar phrase with a restrained answer or ending.
- Evolving phrase: a four-bar phrase with a limited number of supporting changes, not wholesale regeneration each bar.
- Compute duration from global pulses: a bar contains `rate × 4` pulses. Rhythm Steps alone do not determine bar length when division or series repeats differ.
- New grooves initially use rate 4 and global clock/division 1 where practical. Reshape preserves existing timing; unsupported timing configurations remain protected and are reported.
- Use modest authored voice levels, synth decay/filter ranges, and effect sends for new grooves. Keep master volume unchanged. Do not randomly sweep the entire sound parameter space.

## 5. Respect Euclidean representation and slot limits

Beatling stores Euclidean blocks, not arbitrary hit arrays. Generate from known representable components first.

- Use `euclidHit` as the rhythm truth source and `rhythmsFor` for series expansion.
- One musical part may occupy multiple disjoint blocks. Score their combined audible events and detect duplicates before compilation.
- Reserve bass, lead, and their pitch sources before filling the remaining slots with percussion.
- When space runs out, reduce optional ornamentation before removing requested core parts. Report a capacity conflict if requested parts cannot fit.
- `presets.ts` contains a private exact lane decomposition search. Do not put that unrestricted recursive search in an interactive generator. Reuse only after extracting a bounded helper with regression coverage, or use precompiled component catalogs instead.
- Use existing authored presets as local musical references and fixtures. Do not mutate or randomly select a whole preset and call that guided generation.

## 6. Preview, reroll, and commit

The Listen page shows a short musical summary and a compact rhythm preview, plus **Play preview**, **Stop**, **Try another**, **Back**, **Apply**, and **Cancel**.

- Generating or rerolling changes only the dialog draft. It does not add undo entries or save a patch.
- Keep the original source snapshot for every reroll so Reshape does not drift progressively farther away.
- Try another preserves answers and protected parts, and advances the seed. Avoid returning an identical candidate when alternatives exist.
- Keep recently heard candidates in a small in-dialog history so the user can return to an earlier result.
- Defer independent “reroll bass only” buttons until dependency-aware partial generation is proven. A part's rhythm, pitch source, and shared voice settings must stay coherent.

Use the existing engine for audition through a focused transaction/controller; do not create a second AudioContext.

1. Opening or generating is silent and leaves current playback alone.
2. Pressing Play preview pauses current transport, suspends song advancement, resets the engine, and auditions the draft. Creating/resuming audio happens inside that user action.
3. Stop, Back, Cancel, closing, and unmount all stop audition and restore the committed patch in the engine. After audition, leave transport stopped; offer normal Play to restart. Do not claim to restore the exact previous playback position or effect tails.
4. Reroll during audition stops preview; the next Play starts the new candidate from its beginning.
5. Apply stops audition and commits exactly once to the originating variation through existing history, persistence, and reset semantics. Undo restores the source patch; redo restores the accepted result.
6. Capture source variation identity and revision. If song mode or another action changed the committed source before Apply, require an explicit refresh/rebase in the dialog rather than overwriting a different variation or newer edits.

The preview controller must also account for committed volume synchronization, engine snapshots, and song callbacks so unrelated React effects cannot overwrite or commit the audition draft.

First-release Apply targets the current source variation. Existing variation controls can create a destination before opening the dialog. “Apply as new variation” and automatic A/B/C/D generation are later additions; they require explicit arrangement-history behavior.

## 7. Implementation boundaries

Proposed modules, with names adjustable during implementation:

| Module | Responsibility |
| --- | --- |
| `src/lib/musical-randomizer/types.ts` | Request, profiles, role plans, diagnostics, result contracts |
| `src/lib/musical-randomizer/profiles.ts` | Authored rhythm/pitch catalogs, musical targets, sound recipes |
| `src/lib/musical-randomizer/constraints.ts` | Lock/dependency closure, eligible parts, slot allocation constraints |
| `src/lib/musical-randomizer/generate.ts` | Seeded candidate selection, bounded orchestration, immutable patch compilation |
| `src/lib/musical-randomizer/evaluate.ts` | Event/pitch evaluation and named scoring criteria |
| `src/hooks/use-musical-randomizer.ts` | Dialog session, answers, draft/candidate history, source revision |
| `src/hooks/use-patch-audition.ts` | Engine audition lifecycle through a narrow controller interface |
| `src/components/musical-randomizer-dialog.tsx` | Accessible questions and preview controls |
| `src/components/pattern-toolbar.tsx` | Extracted existing actions plus the new entry point |

`App.tsx` remains the composition root. Extract the toolbar and focused audition coordination before wiring the new flow; do not add the wizard state machine directly to App. Keep generation free of React, storage, browser APIs, and audio-node creation.

Use an explicit seeded PRNG, with stable derived streams for roles. The same normalized source, request, seed, and generator version produce the same patch. Generate deterministic rhythm IDs without wall-clock calls. This is patch determinism, not bit-identical audio: noise synthesis and preserved stochastic routes can still vary during playback.

Keep request/seed metadata transient initially. The accepted output is an ordinary existing-format patch and uses existing save/export. Reproducing the recipe after reload would require a separate versioned metadata decision; do not add hidden fields to Patch. No new dependency is expected.

## 8. Delivery sequence

1. **Contracts and musical fixtures.** Finalize the questions and both-mode rules. Define four profiles, representative drum foundations, and tested bass/lead recipes. Write examples of expected combined events and pitches.
2. **Pure generator.** Build constraint resolution, deterministic selection, compilation, and diagnostics. Include all three instrument families from this stage. Verify slot capacity and immutability.
3. **Musical evaluation and calibration.** Add density, anchor, overlap, pitch-motion, and similarity checks. Listen to a fixed matrix of seeds/settings and adjust profile data.
4. **Guided UI.** Extract the toolbar, build questions and visual draft preview, wire locks and unchanged/conflict messages, and connect single-commit Apply.
5. **Audio audition.** Add the focused preview controller with cancellation, transport/song isolation, cleanup, and source-revision checks.
6. **Release validation and documentation.** Add help text and architecture responsibilities; complete automated checks and listening review before shipping.

## 9. Acceptance criteria and tests

Domain tests:

- Same inputs/seed/version produce the same patch; alternative seeds produce varied valid results when constraints allow.
- Exactly 16 stable slots, valid ranges, bounded series, valid routes, and no input mutation.
- Locked fields, kept parts, protected dependency closures, and excluded parts remain unchanged as defined by mode.
- Foundation survives changes in density and syncopation; spacious and busy produce measurably different supporting activity across a fixed seed suite.
- Synth pitches match the actual quantizer/LFO evaluation and chosen tonal policy; bass and lead remain within intended registers.
- Series return at the intended phrase boundary; no unintended same-voice duplicate hits.
- Fully constrained patches, missing roles, muted voices, occupied slots, unusual rates, and routed patches return useful diagnostics rather than silent failure.
- Existing presets, Shuffle, exports, and normalization retain their behavior.

UI and integration tests:

- Both modes, all instrument selections, question defaults, Back, reroll, candidate history, and conflict messages work through accessible controls.
- Generate/Cancel never alter committed history, persistence, other variations, or song parts.
- Apply creates one undo entry; undo/redo round-trip the accepted patch.
- Audition uses only the existing engine and cleans up on every exit path. Song callbacks cannot advance arrangement state during audition.
- Source changes invalidate stale Apply; keyboard focus returns to the trigger; shortcuts do not edit the background instrument while interacting with the dialog.
- Engine integration verifies generated note/event timing, modulation order, first-cycle behavior, and phrase transitions.

Listening review is required alongside numerical tests: audition each profile at every density level with multiple seeds, both with default sounds and representative reshaped patches. Assess recognisable pulse, rhythm interaction, bass/lead coherence, repetition, space, and mix. Record weak examples as fixtures or catalog corrections; a heuristic score alone cannot establish musical quality.

Run the smallest relevant tests during development and the repository's full `npm run quality` gate before handing off implementation. Preserve or reduce React Doctor's known structural warnings and document anything that cannot be resolved safely.

## Suggested first milestone

A deterministic generator callable from tests that accepts the five musical answers plus tempo/key/part settings and outputs a coordinated drum, bass, and lead patch for each of the four profiles. Establish its musical quality and representation limits before building the complete audition workflow.
