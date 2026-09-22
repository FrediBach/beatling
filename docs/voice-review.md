# Voice synthesis review

This review covers all 14 voices in `src/audio/engine.ts`. Findings come from the synthesis code and automated checks, not a listening comparison against hardware. The 808/909/303/101 labels describe inspirations; these are compact synthesized circuits.

## Changes by voice

Drum synthesis controls appear under **Custom → Configure**. Open-hat articulation controls work with all three models. Bassline and Lead expose their controls directly. Existing Tune, Decay, level, modulation and effect sends still apply.

| Voice | Limitation found | Implemented improvement and useful settings |
| --- | --- | --- |
| Kick | The body is always a sine; its noise click cannot add sustained harmonic presence. | **Body harmonics** blends sine toward triangle without changing pitch sweep or body length. Try 20–40% for more upper harmonics, or 0% for the original sine. |
| Snare | Shell oscillators always decay in 130 ms × Decay, regardless of wire/noise length. | **Body length**, 30–600 ms, separates shell ring from wire length. Short body plus longer noise gives a tighter shell with a sustained wire tail. |
| Clap | Burst count and spacing are editable, but each burst has a fixed 18 ms decay. | **Burst length**, 5–60 ms, allows separated cracks or overlapping bursts. The diffuse tail retains its own length and level. |
| Rim | Two square partials always have equal levels, limiting changes in pitch emphasis. | **Partial balance** emphasizes either partial; 50% preserves equal levels. Total oscillator gain stays constant across the blend. |
| Closed hat | High-pass controls remove bass but cannot soften the top of the combined metal/noise signal. | **Brightness** applies a final low-pass to both layers. Lower it for a darker tick; 20 kHz bypasses the extra filter. |
| Open hat | Same brightness limitation; randomized noise offsets can also truncate long tails. | **Brightness**, plus looping noise with an explicit stop at the intended end of the envelope. |
| Low tom | A single sine body and short noise attack offer no independently adjustable shell mode. | **Overtone** adds a sine at 1.5 × body pitch with 45% of its decay time, useful for a shorter pitched knock over the low body. |
| Mid tom | Same single-mode design; changing body pitch does not change the balance of body and shell. | Independent **Overtone** level for the mid register. Fundamental pitch and sweep remain intact. |
| High tom | Same single-mode design; extra attack noise adds broadband energy rather than a pitched mode. | Independent **Overtone** level for a pitched attack component. |
| Cowbell | Its two square oscillators always have equal levels. | **Partial balance** shifts emphasis between the two pitches, preserving the centered mix. Zero Tone level also stays silent throughout the envelope. |
| Cymbal | The metal/noise wash lacks a final brightness control, and its long noise tail may run out of buffer. | **Brightness** softens both layers together. Noise now lasts for the full requested tail, including lengths beyond the shared two-second buffer. |
| Shaker | Attack can exceed the requested duration at short Decay settings, putting the decay endpoint before the attack peak. Zero Noise level can also ramp up to the old envelope floor. | The envelope now ends at least 5 ms after the attack and honors zero level. Existing Attack, Length, filter and resonance controls suffice; no extra parameter was needed. |
| Bassline | Filter decay also determines amplitude decay, preventing a sustained bass under a short filter sweep. | **Amplitude length**, 0–2400 ms. Zero follows Filter decay; positive values decouple the envelopes. Both still scale with the main Decay control. |
| Lead | Filter sweep follows release, and the companion oscillator only thickens the same register. | **Filter decay**, 0–2400 ms, decouples the sweep (zero follows Release). **Sub oscillator** adds a sine one octave down through the same filter and amplitude envelope. |

Suggested values above are starting points for auditioning, not newly imposed preset settings.

## Hat articulation and bassline accents

**Open hat → Configure → Articulation** now offers **Choke by: Off / Closed hat** and a **Choke release** of 5–100 ms (10 ms by default). This works with 808, 909 and Custom open hats. It fades both metal and noise before their dry/effect-send split, so existing reverb and delay tails continue. A closed hit silences simultaneous open hits regardless of block order or routed/Bernoulli triggering. Muted or zero-level closed hats do not choke. Later open hits play normally, and repeated closed hits cannot lift or extend an already closing tail. Choke membership is captured when an open hit is created: switching the setting off affects new hits; previously opted-in tails can still be closed.

**Bassline → Configure → Accent** keeps the original Accent strength and adds:

- **Accent brightness**, 0–100%: at full Accent, raises the filter envelope peak by up to two octaves, bounded by the existing cutoff ceiling and sample rate.
- **Accent length**, 0–100%: at full Accent, extends the filter decay up to twice its base length. Amplitude follows only when Amplitude length is zero; an independently set amplitude length stays independent.
- **Accent source: Every note / Level modulation**: Every note retains the original constant accent. Level modulation uses the positive part of the combined block and shared-voice Level routes, bounded to 0–1, to scale Accent. Midpoint and negative modulation are unaccented; the existing level modulation still changes amplitude.

For a starting accent pattern, route a square Modulator to the bassline's Level at full depth, select Level modulation as Accent source, then try Accent 60%, Accent brightness 40% and Accent length 30%. Use the existing modulation controls to place the high and low portions. These controls add filter-envelope articulation; they are not a nonlinear ladder-filter emulation.

## Shared corrections and compatibility

- Noise loops the existing buffer from a randomized offset and stops explicitly after the requested duration. No new noise buffer is generated per hit.
- Zero-level layers stay at zero; positive envelopes finish their exponential tail with a short ramp to exact silence.
- Shaker attack/decay ordering is valid at the full supported range. All sources retain bounded stop times.
- Voice filter cutoffs and oscillator creation respect the active sample rate's Nyquist limit, including 32 kHz contexts. Low synth pitches remain available below 20 Hz.
- Patch and arrangement format **v11** stores the numeric custom settings, including hat choking and bassline accent articulation. Readers still migrate v1–v10 storage and JSON. Older patches receive neutral defaults: no added harmonics/overtones/sub, bypassed brightness, centered partial balance, original snare/clap lengths and linked synth envelopes. Choking is off; accent brightness/length are zero and the accent source is Every note.
- 808/909 drum selections retain their existing circuits; choose Custom for the added shaping controls. Preset rhythms, balances, effect sends, routing and variation histories retain their existing meaning. The shared envelope/noise bug fixes apply to all models.

## Remaining synthesis opportunities

These require separate behavior decisions or auditioning rather than additional unlabeled knobs:

1. **Monophonic synth articulation.** Bassline and Lead currently create a new one-shot graph per hit. Glide, legato and gate-driven sustain need persistent voice state and explicit retrigger rules; adding a Glide slider alone would not solve this.
2. **Nonlinear bassline filter.** Accent now optionally shapes the filter envelope, but the filter itself remains a native Web Audio low-pass. A calibrated nonlinear stage needs reference listening and level-matched comparisons.
3. **Metallic texture.** Hats and cymbal share a six-square-wave source. Separate stick/bell/wash envelopes or a richer excitation model could produce more distinct cymbal articulation. Brightness provides tonal control but does not replace that source model.
4. **Model differentiation.** Rim, cowbell and shaker have no separate 808/909 synthesis branches; tom models mainly differ in duration. The UI labels should not be taken as separate accurate emulations. More distinct models need reference listening and level-matched comparisons.
5. **Rim layer independence.** Rim noise still runs through the tone envelope, so Tone level acts on its crack as well. Decoupling it needs an explicit migration choice to retain old patches' effective noise level and envelope.

## Verification

`src/audio/voices.test.ts` exercises real synthesis dispatch with a recording Web Audio boundary: every voice at parameter extremes, finite automation, bounded source lifetimes, low-sample-rate cutoffs, long noise tails, zero-level envelopes, independent layer lengths, partial balance, brightness routing, added oscillators and synth-envelope independence. These checks validate scheduled graphs; they do not measure rendered spectra or establish subjective sound quality.

`src/audio/hat-choke.test.ts` covers audio-time releases, cleanup, repeated closes, mid-fade reset and bounded tracking. The voice integration tests additionally exercise simultaneous routed/Bernoulli hats in both orders, all hat models, bypass/mute behavior, engine teardown and accent modulation/envelope coupling.

`src/lib/voice-config.test.ts` covers v9/v10 storage migration, neutral defaults, new-control round trips, numeric bounds and malformed values. `src/components/voice-bank.test.tsx` verifies accessible editing, reopening and resetting of every new control, including choking across model changes. The full quality gate also checks the existing preset and routing suite.
