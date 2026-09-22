# Voice synthesis review

This review covers all 14 voices in `src/audio/engine.ts`. Findings come from the synthesis code and automated checks, not a listening comparison against hardware. The 808/909/303/101 labels describe inspirations; these are compact synthesized circuits.

## Changes by voice

Drum synthesis controls appear under **Custom → Configure**. Open-hat articulation controls work with all three models. Bassline and Lead expose their controls directly. Existing Tune, Decay, level, modulation and effect sends still apply.

| Voice | Limitation found | Implemented improvement and useful settings |
| --- | --- | --- |
| Kick | The body is always a sine; its noise click cannot add sustained harmonic presence. | **Body harmonics** blends sine toward triangle without changing pitch sweep or body length. Try 20–40% for more upper harmonics, or 0% for the original sine. |
| Snare | Shell oscillators always decay in 130 ms × Decay, regardless of wire/noise length. | **Body length**, 30–600 ms, separates shell ring from wire length. Short body plus longer noise gives a tighter shell with a sustained wire tail. |
| Clap | Burst count and spacing are editable, but each burst has a fixed 18 ms decay. | **Burst length**, 5–60 ms, allows separated cracks or overlapping bursts. The diffuse tail retains its own length and level. |
| Rim | Equal partial levels limit pitch emphasis; the noise crack also follows Tone level and the body envelope. | **Partial balance** emphasizes either partial. **Noise envelope: Independent** separates the crack from the tone, with its own **Noise length**; Linked preserves the original sound. |
| Closed hat | High-pass controls cannot soften the combined signal; noise and metal share one decay. | **Brightness** applies a final low-pass (20 kHz bypasses it). **Metal length** separates the pitched ring from the noise tick. |
| Open hat | Shared metal/noise decay restricts articulation; randomized noise offsets can truncate long tails. | **Brightness**, full-length looping noise and independent **Metal length**. Choking covers both layers through the longer tail. |
| Low tom | A single sine body and short noise attack offer no independently adjustable shell mode. | **Overtone** adds a sine at 1.5 × body pitch with 45% of its decay time, useful for a shorter pitched knock over the low body. |
| Mid tom | Same single-mode design; changing body pitch does not change the balance of body and shell. | Independent **Overtone** level for the mid register. Fundamental pitch and sweep remain intact. |
| High tom | Same single-mode design; extra attack noise adds broadband energy rather than a pitched mode. | Independent **Overtone** level for a pitched attack component. |
| Cowbell | Its two square oscillators always have equal levels. | **Partial balance** shifts emphasis between the two pitches, preserving the centered mix. Zero Tone level also stays silent throughout the envelope. |
| Cymbal | Metal ring and noise wash share a decay and the source lacks a distinct pitched strike. | **Metal length** separates ring from wash. Optional **Bell level/pitch/length** adds an independently shaped strike. **Brightness** softens all layers; noise lasts for the full requested tail. |
| Shaker | Attack can exceed the requested duration at short Decay settings, putting the decay endpoint before the attack peak. Zero Noise level can also ramp up to the old envelope floor. | The envelope now ends at least 5 ms after the attack and honors zero level. Existing Attack, Length, filter and resonance controls suffice; no extra parameter was needed. |
| Bassline | Filter decay also determines amplitude decay, preventing a sustained bass under a short filter sweep. | **Amplitude length**, 0–2400 ms. Zero follows Filter decay; positive values decouple the envelopes. Both still scale with the main Decay control. |
| Lead | Filter sweep follows release, and the companion oscillator only thickens the same register. | **Filter decay**, 0–2400 ms, decouples the sweep (zero follows Release). **Sub oscillator** adds a sine one octave down through the same filter and amplitude envelope. |

Suggested values above are starting points for auditioning, not newly imposed preset settings.

## Percussion layer envelopes

**Rim → Custom → Configure → Noise** offers **Noise envelope: Linked / Independent** and **Noise length**, 5–200 ms. Linked preserves the original sound: both the crack and pitched partials pass through Tone level and the body envelope; Noise length is ignored. Independent gives the crack its own envelope, scaled by Decay, through a separate filter with the same Body filter and resonance settings. Tone level can reach zero while noise remains audible, and Noise level can reach zero without silencing the tone. Independent mode removes the extra attenuation from Tone level and the shared envelope, so the crack may need a lower Noise level when switching modes. Try Independent with Noise length 30–60 ms over a shorter body, then adjust Noise level to taste.

**Closed hat / Open hat / Cymbal → Custom → Configure → Envelope** adds **Metal length**. Zero follows the existing Closed length, Open length or Length control. Positive values set a separate metal envelope (up to 300 ms, 1800 ms and 4000 ms respectively), while the original length controls the noise. Both lengths scale with the main Decay control and its modulation. Try a 120 ms closed-hat ring with a 30 ms noise tick, or a 300 ms cymbal ring over a 1400 ms wash. Brightness still filters both layers, and open-hat choking still fades both layers even after the shorter one has ended. These changes separate the existing layers; they do not add a new metallic source model.

## Cymbal bell

**Cymbal → Custom → Configure → Bell** adds a pitched layer over the existing metal and noise:

- **Bell level**, 0–100%: zero disables the layer and allocates no extra oscillators.
- **Bell pitch**, 200–2000 Hz: the lowest bell partial, before the voice's Tune control and modulation.
- **Bell length**, 20–2000 ms: independent decay, scaled by the voice's Decay control and modulation.

The bell combines three sine partials with a brief attack. Upper partials decay faster, leaving a simpler ring after the initial strike. The amplitude weights sum to one before Bell level; adding a bell still adds energy to the cymbal mix. Modes above the sample-rate ceiling are omitted. Bell, metal and noise share Brightness and the voice's level and effect sends; the metal/noise high-pass controls do not filter the bell. Set Metal level and Noise level to zero to audition the bell alone.

Try Bell level 20–35%, Bell pitch 800–1100 Hz and Bell length 300–600 ms, then balance against the wash. These are starting points for listening, not a calibrated ride-cymbal emulation. Bell level defaults to zero, preserving existing patches, and the 808/909 models ignore the bell controls.

## Hat articulation and bassline accents

**Open hat → Configure → Articulation** now offers **Choke by: Off / Closed hat** and a **Choke release** of 5–100 ms (10 ms by default). This works with 808, 909 and Custom open hats. It fades both metal and noise before their dry/effect-send split, so existing reverb and delay tails continue. A closed hit silences simultaneous open hits regardless of block order or routed/Bernoulli triggering. Muted or zero-level closed hats do not choke. Later open hits play normally, and repeated closed hits cannot lift or extend an already closing tail. Choke membership is captured when an open hit is created: switching the setting off affects new hits; previously opted-in tails can still be closed.

**Bassline → Configure → Accent** keeps the original Accent strength and adds:

- **Accent brightness**, 0–100%: at full Accent, raises the filter envelope peak by up to two octaves, bounded by the existing cutoff ceiling and sample rate.
- **Accent length**, 0–100%: at full Accent, extends the filter decay up to twice its base length. Amplitude follows only when Amplitude length is zero; an independently set amplitude length stays independent.
- **Accent source: Every note / Level modulation**: Every note retains the original constant accent. Level modulation uses the positive part of the combined block and shared-voice Level routes, bounded to 0–1, to scale Accent. Midpoint and negative modulation are unaccented; the existing level modulation still changes amplitude.

For a starting accent pattern, route a square Modulator to the bassline's Level at full depth, select Level modulation as Accent source, then try Accent 60%, Accent brightness 40% and Accent length 30%. Use the existing modulation controls to place the high and low portions. These controls add filter-envelope articulation; they are not a nonlinear ladder-filter emulation.

## Mono retrigger and glide

**Bassline / Lead → Configure → Articulation** now offers **Playback: Polyphonic / Mono retrigger** and **Glide**, 0–500 ms.

Polyphonic retains independent overlapping notes and ignores Glide. Mono retrigger fades the previous notes over 5 ms and starts a fresh amplitude/filter envelope for each hit. This is a retriggered voice: oscillators still start anew on each hit, rather than remaining phase-continuous through a legato phrase.

Glide runs at a constant rate in semitones over the selected duration, starting from the previous note's current pitch. Interrupting a slide continues from its intermediate pitch. The lead's main, sub and companion oscillators slide together with their existing tuning offsets. After the previous amplitude envelope has finished, the next note starts directly at its target pitch. Short note envelopes may finish before a long glide reaches its target.

Every sequencer and Bernoulli source assigned to a synth shares that synth's mono voice; Bassline and Lead remain independent. At simultaneous hits, the last hit in the scheduler's deterministic traversal order wins. An unheard simultaneous note is not used as a new glide source. Switching from Polyphonic to Mono retrigger closes all older tails of that synth; switching back allows subsequent notes to overlap. Existing reverb/delay tails remain audible.

Try Mono retrigger with Glide around 60–100 ms and an amplitude length longer than the gap between hits. Use the existing V/Oct route for the pitch pattern. Each note continues to apply its own tuning, decay, level and bassline accent modulation.

Stop and pattern reset now fade synth output and cancel scheduled synth notes in both playback modes, clearing glide memory. This fixes pending synth hits continuing after transport reset. Existing shared effect tails are left to decay. Note gates are reclaimed using the actual audio clock and bounded to 256 retained notes per synth; excessive routed bursts skip additional notes until capacity is available. JSON retains the controls; MIDI/Strudel exports do not reproduce this articulation.

## Shared corrections and compatibility

- Noise loops the existing buffer from a randomized offset and stops explicitly after the requested duration. No new noise buffer is generated per hit.
- Zero-level layers stay at zero; positive envelopes finish their exponential tail with a short ramp to exact silence.
- Shaker attack/decay ordering is valid at the full supported range. All sources retain bounded stop times.
- Voice filter cutoffs and oscillator creation respect the active sample rate's Nyquist limit, including 32 kHz contexts. Low synth pitches remain available below 20 Hz.
- Patch and arrangement format **v14** stores the numeric custom settings, including hat choking, bassline accent articulation and synth playback/glide. Readers still migrate v1–v13 storage and JSON. Older patches receive neutral defaults: no added harmonics/overtones/sub, bypassed brightness, centered partial balance, original snare/clap lengths and linked synth envelopes. Choking is off; accent brightness/length are zero and the accent source is Every note. Both synths default to Polyphonic with zero Glide; all existing voice shaping, accent and choke values are retained. Rim noise defaults to Linked (20 ms Noise length when Independent is enabled); hat/cymbal Metal length defaults to zero to follow the original duration. Cymbal Bell level defaults to zero, with 800 Hz Bell pitch and 500 ms Bell length ready when enabled.
- 808/909 drum selections retain their existing circuits; choose Custom for the added shaping controls. Preset rhythms, balances, effect sends, routing and variation histories retain their existing meaning. The shared envelope/noise bug fixes apply to all models.

## Remaining synthesis opportunities

These require separate behavior decisions or auditioning rather than additional unlabeled knobs:

1. **Legato and gate-driven sustain.** Mono retrigger and glide now share persistent note ownership and pitch state, but still create a new synthesis graph per hit. Phase-continuous legato and gate-driven sustain require reusable oscillator/filter graphs, explicit gate overlap semantics and a separate envelope design.
2. **Nonlinear bassline filter.** Accent now optionally shapes the filter envelope, but the filter itself remains a native Web Audio low-pass. A calibrated nonlinear stage needs reference listening and level-matched comparisons.
3. **Metallic texture.** Hats and cymbal share a six-square-wave source. Metal and noise now have independent lengths. The cymbal also has an optional additive bell with faster-damping upper partials. A dedicated stick transient or richer wash excitation could further distinguish it from the hats; the current bell is a designed timbre, not a physical model.
4. **Model differentiation.** Rim, cowbell and shaker have no separate 808/909 synthesis branches; tom models mainly differ in duration. The UI labels should not be taken as separate accurate emulations. More distinct models need reference listening and level-matched comparisons.

## Verification

`src/audio/voices.test.ts` exercises real synthesis dispatch with a recording Web Audio boundary: every voice at parameter extremes, finite automation, bounded source lifetimes, low-sample-rate cutoffs, long noise tails, zero-level envelopes, independent layer lengths, rim noise routing/zero levels, long metal-tail choking, legacy model compatibility, independent bell pitch/decay/routing and high-frequency mode omission, partial balance, brightness routing, added oscillators and synth-envelope independence. These checks validate scheduled graphs; they do not measure rendered spectra or establish subjective sound quality.

`src/audio/hat-choke.test.ts` covers audio-time releases, cleanup, repeated closes, mid-fade reset and bounded tracking. The voice integration tests additionally exercise simultaneous routed/Bernoulli hats in both orders, all hat models, bypass/mute behavior, engine teardown and accent modulation/envelope coupling.

`src/audio/synth-articulation.test.ts` checks note stealing, interrupted glides, simultaneous-hit arbitration, gaps, mode changes, audio-time cleanup, reset and bounded tracking. Voice integration tests exercise both synths, synchronized lead oscillators, independent ownership, muted triggers, routed/Bernoulli hits and transport teardown.

`src/lib/voice-config.test.ts` covers v9/v10/v11/v12/v13 storage migration, neutral defaults, new-control round trips, numeric bounds and malformed values. `src/components/voice-bank.test.tsx` verifies accessible editing, reopening and resetting of every new control, including choking across model changes and synth playback/glide. The full quality gate also checks the existing preset and routing suite.
