# Beatling Lua export: Luading implementation contract

This is the handoff for implementing the Euclid Grid data consumer in Luading. It describes the exporter in [`src/export/lua.ts`](../src/export/lua.ts), checked against Beatling's `euclid-grid.v29` patch model and current sequencer engine on 2026-09-23.

The file is a Lua chunk returning one table. It contains the **active patch's rhythm and control graph**: 16 sequencers, their clocks/resets/mutes, rhythm series, LFOs and rhythm modulation, plus output descriptors. Luading must supply the runtime and host output integration. The file contains no callbacks or instrument implementation.

The Luading consumer is not in this repository. This contract is verified against Beatling; compatibility with an existing Luading implementation and hardware output behavior still needs integration testing.

## Audit results and compatibility

The audit found the existing series, routing, numeric waveform IDs and Euclidean LFO flag current. The following exporter corrections accompany this document:

| Area | Current behavior |
| --- | --- |
| Swing | Exported as top-level `swing`, in percent. Previously omitted. |
| Bernoulli gates | Export `prob=100` and omit Chance modulation, preserving their combined trigger stream. Branch selection remains browser-only. Previously branch probability could incorrectly discard exported triggers. |
| Modulation depth | Preserve the stored numeric value instead of rounding to two decimal places. |
| Linear output allocation | Only nonzero, exported rhythm routes request an LFO output. Omitted voice routes no longer consume slots. |
| Output exhaustion | Emit a comment naming LFO sources without a physical output; keep their internal routes. |

`version=1` remains the Lua schema version. It is independent of JSON patch version 29. Existing field meanings and numeric IDs are unchanged; `swing` is an additive field. A consumer should use `data.swing or 0` for older files and tolerate unknown fields. Older consumers can ignore `swing`, but will play straight timing. Re-export older Bernoulli files to get corrected trigger probabilities: their data does not identify the block kind sufficiently to repair them reliably.

Output numbers are allocated anew from each patch. Do not persist host assignments based only on an old `out`/`lout` number when loading a new export; allocation can change, including after this correction.

## Top-level table

| Field | Type / values | Meaning |
| --- | --- | --- |
| `version` | integer, `1` | Lua contract version. Reject unsupported versions explicitly. |
| `bpm` | number, normally 20–300 | Quarter-note beats per minute. |
| `rate` | integer, 2 / 4 / 6 / 8 | Global pulses per quarter note, not a denominator. UI labels are 1/8, 1/16, 1/8T and 1/32 respectively. |
| `bar` | integer, `rate * 4` | Pulses per four-quarter-note bar. |
| `swing` | number, 0–70 | Delay applied to odd global pulse indices; missing means zero. |
| `outputs` | dense array, 1–28 entries | Ordered output declarations. |
| `blocks` | dense array, exactly 16 entries | Fixed routing identities, including silent and unconnected blocks. |

All arrays use Lua's one-based indices. Beatling's internal zero-based block references are converted during export. Do not compact or reorder `blocks`.

The exporter expects a valid application patch and does not validate arbitrary input itself. A Luading file loader should validate finite numbers, field ranges, array lengths and referenced indices before installing a graph. Comments are explanatory and are not part of the machine-readable contract.

### Timing

For a constant tempo, use a zero-based global pulse counter `n`:

```text
interval = 60 / bpm / rate                       -- seconds
delay(n) = (n odd) ? (swing / 100) * interval / 2 : 0
pulseTime(n) = startTime + n * interval + delay(n)
```

Advance the unswung base time by `interval` after each pulse. Swing does not change the bar length. At 120 BPM, rate 4 and swing 50, the first four times relative to start are `0, 0.15625, 0.25, 0.40625` seconds. Generate a bar event on pulse zero and every `bar` pulses thereafter.

## Block fields

| Field | Type / normal range | Meaning |
| --- | --- | --- |
| `steps` | integer, 1–32 | First rhythm's length. |
| `pulses` | integer, 0–steps | First rhythm's fill. |
| `rot` | integer | First rhythm's signed rotation; apply modulo steps. |
| `series` | array of 1–8 rhythm tables | Complete ordered series, **including** the first rhythm. Each has `steps`, `pulses`, `rot`, `repeats`; repeats is 1–16. |
| `div` | integer, 1–16 | Advance only on every Nth received clock. |
| `prob` | number, 0–100 | Probability that a filled step emits a trigger. Bernoulli projection always exports 100. |
| `gate` | number, 5–200 | Gate duration as a percent of the latest incoming clock interval; see runtime details below. |
| `clk` | array of source integers | Any listed source clocks this block. Empty means no clock. |
| `rst` | source integer | Reset source, with special sentinels below. |
| `mut` | integer | Gate-level mute input: 0 means none, otherwise a block index. |
| `mn` | boolean | Manual block mute. |
| `shape` | integer, 1–4 | LFO waveform ID. |
| `euclidean` | boolean | `true`: continuous hit-to-hit LFO. `false`: stepped once-per-pattern LFO. Does not disable Euclidean trigger generation. |
| `mods` | array of route tables | Rhythm modulation, evaluated at incoming clock time. |
| `out` | integer, 0 or output index | Stepped trigger/gate output; zero means no assigned host output. |
| `lout` | integer, 0 or output index | Linear LFO output; zero means no assigned host output. |
| `tag` | string | Display label, not a synthesis instruction. |

Top-level block `steps/pulses/rot` duplicate `series[1]` for compatibility. Use `series` when present. For a legacy row without `series`, construct one rhythm from those fields with `repeats=1`. Rhythm IDs are editor identities and are intentionally omitted.

### Source encoding

| Value | In `clk` | In `rst` | In `mut` |
| --- | --- | --- | --- |
| `0` | Global pulse | Every global pulse | No mute source |
| `-1` | Not emitted | Bar boundary | Not emitted |
| `-9` | Not emitted | No reset source | Not emitted |
| `1..16` | That block's trigger | That block's trigger | That block's gate is high |

`mods[].src` is also a **block index** in `1..16`. It is never an output index. Block 16 can drive internal modulation even with `lout=0`. Lua treats zero as truthy: explicitly test `out > 0`, `lout > 0` and `mut > 0` before indexing.

### Output allocation and labels

Each output is `{ type="stepped" | "linear", name="..." }`. The exporter allocates:

1. A stepped output for each assigned voice block or block used as a clock/reset/mute source, in block order.
2. A linear output for each source used by a nonzero exported rhythm modulation route, in block order, until 28 total outputs exist.
3. If neither pass created any output, a fallback stepped output named `01 trig` assigned to block 1.

Silent or manually muted voice blocks still get stepped outputs. Unconnected modulators and Bernoulli blocks do not automatically get stepped outputs. A source shared by multiple routes gets one linear output. A connected zero-depth route remains in `mods` but does not request an output. All 16 blocks still run internally regardless of output allocation.

Names use the original two-digit block number, such as `01 Kick`, `15 trig`, or `13 LFO`. Voice tags are:

| Voice | Tag | Voice | Tag |
| --- | --- | --- | --- |
| Kick | `BD` | Snare | `SD` |
| Clap | `CP` | Rim | `RS` |
| Closed hat | `CH` | Open hat | `OH` |
| Low tom | `LT` | Mid tom | `MT` |
| Hi tom | `HT` | Cowbell | `CB` |
| Cymbal | `CY` | Shaker | `MA` |
| Bassline | `303` | Lead | `101` |

Non-voice rows have tag `--`. The data defines neither hardware port numbers nor output voltages. The Luading adapter must map the output descriptors and convert internal gates/LFO values to the host's output scale. Internal LFO values are 0–1; gates are logically high/low. The cap of 28 is an exporter allocation rule, not a hardware capability claim.

## Runtime behavior to reproduce

References: [`engine.ts`](../src/audio/engine.ts) (`tick`, `advance`, `resetBlock`), [`euclid.ts`](../src/lib/euclid.ts), [`rhythm-series.ts`](../src/lib/rhythm-series.ts).

### Event order and feedback guards

For each global pulse, start a FIFO queue with the global event, followed by the bar event when applicable. For every dequeued event:

1. Reset **all** blocks whose `rst` matches the source.
2. Visit blocks in ascending index order. Advance each whose `clk` contains that source.
3. Append a source event for each block that fired, at the same timestamp.

A block with both global and routed clocks can receive multiple clocks at one timestamp. Multiple entries of the same source in `clk` still match once per event. Keep the browser's bounds: at most 400 dequeued events per global pulse and at most eight advance calls per block per global pulse. Do not recursively traverse an unbounded routing cycle. The browser's lookahead scheduler additionally limits its outer loop to 64 global pulses per scheduler call.

Ordering is audible: earlier blocks can update LFOs/gates before later blocks sample them. The bar event follows the initial global event but precedes triggers appended while processing that event. Do not move bar resets ahead of the global pulse when matching Beatling.

### Advancing, series and gates

Initial state per block: position `-1`, first rhythm, repeat counter `0`, input-clock counter `0`, no last-clock time, no LFO anchor, gate low, and an initialized random value.

On every matching clock:

1. Measure the incoming interval. Use the global interval for the first clock; otherwise `max(0.008, time - lastClock)`. Update `lastClock`, including clocks discarded by division.
2. Increment the input-clock counter, compute effective parameters, and return without advancing unless `counter % effectiveDiv == 0`. Division 2 therefore first advances on the second input clock.
3. If the previous position was the last step, increment the rhythm's completed-cycle counter. Move to the next rhythm when its repeat count is exhausted, wrapping the series; recompute effective parameters for the new rhythm and set position to zero. Otherwise increment position. The input-clock counter continues across rhythms.
4. Determine the Euclidean hit and update the LFO anchor/random state, even if muted or probability later rejects the hit.
5. Emit only if this is a filled step, manual mute is false, the mute input's gate is low, and a uniform random value in `[0,1)` satisfies `random * 100 < effectiveProb`.
6. Set gate interval to `[time, time + max(0.005, incomingInterval * gate / 100))` and enqueue this block's trigger.

Gate duration uses the incoming interval, **without multiplying by division**. LFO step duration does multiply by division. Muting suppresses triggers and gate creation; it does not freeze the pattern or LFO. A rejected hit does not clear an existing gate. A later accepted hit replaces the gate interval, so a shorter new gate can shorten an overlapping gate.

A routed reset clears position, series/repeat progress, clock counter, last-clock time and LFO anchor. The next accepted step is position zero of the first rhythm. A routed reset does **not** clear an already active gate or redraw the stored random value. Transport initialization/reset clears gate state as well.

### Euclidean hit calculation

Positions are zero-based inside each rhythm. Positive rotation adds to position:

```lua
local function euclidHit(position, steps, pulses, rotation)
  if pulses <= 0 then return false end
  if pulses >= steps then return true end
  local offset = ((position + rotation) % steps + steps) % steps
  return (offset * pulses) % steps < pulses
end
```

For eight steps and three pulses, rotation zero hits positions `0, 3, 6`; rotation one hits `2, 5, 7`. This formula is the reference; a different Euclidean distribution algorithm can choose a different starting phase.

### Modulation

Each route is `{ src=blockIndex, dst=destinationNumber, amt=depth }`, where depth is a signed number from -1 to 1. Empty-source and browser voice routes are omitted. Sample the source's internal LFO at event time and calculate `m = (value * 2 - 1) * amt`.

| `dst` | Target | Effective value before clamping |
| --- | --- | --- |
| 1 | Fill | `round(activeRhythm.pulses + m * 8)` |
| 2 | Rotate | `round(activeRhythm.rot + m * activeRhythm.steps)` |
| 3 | Chance | `block.prob + m * 100` |
| 4 | Divide | `round(block.div + m * 4)` |

Match JavaScript rounding with `math.floor(x + 0.5)`, including negative half-integers. Clamp Fill to `0..steps`, Divide to `1..16`, and Chance to `0..100`. Leave rotation signed and wrap it in the hit calculation. Steps are not modulated. Zero-depth routes do nothing.

Each destination normally occurs once. If supporting duplicate destinations from external data, Beatling's evaluator uses the last active route's value calculated from the base parameter, rather than summing routes.

### LFO sampling

Reference: [`lfo.ts`](../src/lib/lfo.ts). Both timing modes use these shapes:

| `shape` | Waveform | Value at phase `p` in 0–1 |
| --- | --- | --- |
| 1 | Ramp | `p` |
| 2 | Triangle | `2*p` if `p <= 0.5`, otherwise `2 - 2*p` |
| 3 | Square | `1` if `p < 0.5`, otherwise `0` |
| 4 | Random | Stored uniform random value |

For `euclidean=false` (assigned voice blocks), phase is `position / activeSteps`; hold the value until the next accepted step. Draw a new random value whenever position becomes zero. Before the first anchor or after reset, this mode returns 0.

For `euclidean=true` (modulators and exported Bernoulli blocks):

1. Store an immutable anchor on every accepted step: timestamp, integer position, effective rhythm, shape, random value, and `stepDuration = incomingInterval * effectiveDiv`.
2. At sampling time, predict `position = anchor.position + clamp((time - anchor.time) / stepDuration, 0, 1)`. If clocks stop, hold at the next step boundary; do not free-run through the pattern.
3. Search backwards from `floor(position)` for the preceding filled step and forwards from that hit for the next hit, wrapping the rhythm. Each search is bounded by `steps`. Phase is `(position - previousHitPosition) / hitGapLength`. A new complete waveform cycle spans every hit-to-hit gap.
4. Random draws occur on filled steps and hold through the following gap, independent of mute/chance. With zero Fill, or before any anchor/after reset, return midpoint 0.5, which gives zero bipolar modulation.

For 3-in-8, hit gaps are 3, 3 and 2 steps. A triangle is zero at positions `0, 3, 6, 8` and one at `1.5, 4.5, 7`. At a series transition, use the newly active rhythm. Keep internal modulation available even when a source has no physical linear output.

The exported file has no random seed or runtime state. Match distributions and timing, not the exact random playback from a prior browser session.

## Worked block example

This is one illustrative row inside `blocks`, not a complete export. Its references assume the full 16-block graph and the declared output array exist:

```lua
{
  steps=8, pulses=3, rot=0,
  series={
    { steps=8, pulses=3, rot=0, repeats=2 },
    { steps=5, pulses=2, rot=1, repeats=1 },
  },
  div=2, prob=75, gate=50,
  clk={0, 2}, rst=-1, mut=16, mn=false,
  shape=2, euclidean=false,
  mods={{ src=13, dst=2, amt=0.5 }},
  out=1, lout=0, tag="BD",
}
```

This block accepts global pulses and block 2 triggers, resets on bars, and is muted while block 16's gate is high. It advances on every second input clock. It plays two eight-step cycles then one five-step cycle before wrapping, unless a reset interrupts. Its rotation is modulated by block 13. Output 1 receives its gates; its own triangle LFO remains internal. `BD` only labels the intended voice.

## Deliberate export limits

| Browser feature | Lua representation |
| --- | --- |
| Voice identity | Output name and tag only; no voice-bank object. |
| 808/909/custom synthesis and synth controls | Omitted, including quantization/root/scale, articulation, glide, accent, choke and envelopes. |
| Voice tune, decay, level, mute and solo | Omitted. Block gates can remain active when the corresponding browser voice is inaudible. |
| Per-block Tune/Decay/Level routes | Omitted from `mods`, with a comment. |
| Shared voice routing, including V/Oct | Omitted, with comments naming connected routes. No pitched CV output is generated. |
| Euclidean Quantizer CV | Omitted, with a comment naming its input. The legacy rhythm/LFO projection does not reproduce the quantized pitch output. |
| Bernoulli voice A/B selection | Omitted, with a comment. Export retains the combined Euclidean trigger stream with `prob=100`; neither the original branch probability nor its modulation is data. |
| Master volume, effect processors and sends | Omitted. |
| Variations, song order, history, editor locks | Omitted; only the active patch is passed to the exporter. |
| Playback position, gate/LFO state, randomness | Omitted; initialize a fresh runtime. |

Use JSON when a full patch representation is needed. Adding synthesis, pitch CV, or separate Bernoulli branch outputs requires an explicit extension to this contract; those features cannot be reconstructed from tags or comments.

## Luading acceptance checks

These cases provide a practical integration baseline:

| Case | Expected result |
| --- | --- |
| Eight steps, Fill 3, Rotate 0, Divide 1, Chance 100 | Hits at `0, 3, 6` in each cycle. |
| Same, Rotate 1 | Hits at `2, 5, 7`. |
| Divide 2 after reset | First step on input clock 2, then clocks 4, 6, etc. |
| 120 BPM, rate 4, swing 50 | Pulse times `0, .15625, .25, .40625`; 16 pulses per bar. |
| Source LFO .75, depth .5, base Fill 3 / Rotate 0 / Chance 50 / Divide 1, eight steps | Modulating each target gives Fill 5 / Rotate 2 / Chance 75 / Divide 2. |
| Bernoulli with Chance 0, 35 or 100 in Beatling | Same combined exported triggers; no exported Chance route. |
| Muted modulator | No trigger/gate creation; LFO continues to follow accepted steps. |
| Empty Fill in continuous LFO mode | Constant .5, hence zero bipolar modulation. |
| 3-in-8 triangle in continuous mode | Peaks at positions `1.5, 4.5, 7`. |
| Two repeats of eight steps, then one of five | Rhythm switch before accepted step 17; series wraps before step 22 (counting accepted steps from 1). |
| 16 voice blocks, all 16 blocks used as rhythm LFO sources | 16 stepped outputs then 12 linear outputs; remaining sources retain internal modulation and get `lout=0`. |
| Cyclic clocks | Bounded processing; no hanging or recursive overflow. |

Repository checks are in [`lua.test.ts`](../src/export/lua.test.ts), [`modulation.test.ts`](../src/lib/modulation.test.ts), [`lfo.test.ts`](../src/lib/lfo.test.ts), and [`engine.test.ts`](../src/audio/engine.test.ts). Run the focused exporter tests with `npm test -- src/export/lua.test.ts src/lib/modulation.test.ts`; the complete repository gate is `npm run quality`.
