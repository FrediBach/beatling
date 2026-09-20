# 808 & 909 Drum Pattern Reference — Preset Library

2026-09-20 · @Someone

A working reference for building factory presets: the canonical rhythm families played on the Roland TR-808 and TR-909, written as 16-step grids ready to port into a sequencer.

## How to read a pattern

Every pattern is one bar of 16 steps, counted `1 e + a 2 e + a 3 e + a 4 e + a`. Longer patterns are written as two or four bars stacked.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . x . . . . . . .
SD     . . . . X . . . . . . . X . . .
CH     x . x . x . x . x . x . x . x .
```

- `X` — accented hit (full velocity / TR ACCENT step on)
- `x` — normal hit
- `o` — open hi-hat (choked by the next closed hat)
- `.` — rest
- `-` — hit held or pitch-glided into the next step (808 kick slides, trap)

Voice codes are the same across both machines where the voice exists.

| Code | Voice | 808 | 909 |
| --- | --- | --- | --- |
| BD | Bass drum | yes | yes |
| SD | Snare drum | yes | yes |
| RS | Rimshot | yes | yes |
| CP | Hand clap | yes | yes |
| CH | Closed hi-hat | yes | yes |
| OH | Open hi-hat | yes | yes |
| CY | Crash / cymbal | yes | yes |
| RD | Ride cymbal | no | yes |
| LT / MT / HT | Low / mid / high tom | yes | yes |
| LC / MC / HC | Low / mid / high conga | yes | no |
| CB | Cowbell | yes | no |
| CL | Claves | yes | no |
| MA | Maracas | yes | no |

Swing is given as a percentage of the 16th grid: 50% is straight, 54–58% is a light shuffle, 62–66% is a hard MPC-style swing, 66.7% is full triplet feel. It is applied to every even 16th step (`e` and `a` positions) unless a pattern says otherwise.

Tempo ranges are the useful window for the style, not a rule. The single figure in brackets is a sensible default for a preset.

## The two machines

The 808 (1980) is fully analogue and synthetic — a bridged-T oscillator kick with a long decay, a noise-and-tone snare, and a percussion bank of congas, cowbell, claves and maracas. The 909 (1983) is a hybrid: analogue kick, snare, toms, rimshot and clap, but sampled 6-bit hi-hats, ride and crash. That split is why the 909 sits in house and techno and the 808 sits in hip hop, electro and pop: the 909's short punchy kick and bright sampled hats cut through a club mix, while the 808's long sub-heavy kick behaves like a bass note.

| Aspect | TR-808 | TR-909 |
| --- | --- | --- |
| Kick character | Long sine-ish decay, up to \~1.5 s, functions as sub-bass | Short, punchy, with a pitch-envelope click attack |
| Snare | Noise + two tuned oscillators, thin and papery | Noise + analogue tone, fatter, has a snappy attack |
| Hi-hats | Analogue, six square oscillators, metallic and dry | 6-bit samples, brighter and more realistic |
| Clap | Long reverb-like tail, the signature 808 sound | Tighter, drier, more of a slap |
| Extra percussion | Congas, cowbell, claves, maracas | Ride cymbal, crash cymbal (no congas or cowbell) |
| Sequencer feel | 16 steps, single global accent | 16 steps, single global accent, plus shuffle and flam |

### Parameters worth exposing in a preset

These are the knobs that actually change a pattern's identity, so a preset should store them alongside the grid.

- **808 BD — Decay and Tone.** Decay near maximum turns the kick into a sustained sub note; this is the whole basis of Miami bass and trap. Tone controls the click.
- **808 SD — Tone and Snappy.** Snappy is the noise-to-tone balance. Low snappy plus low tone gives the muffled 808 snare of early electro.
- **808 CP and CY.** The clap tail and the long cymbal decay are the two sounds people recognise the machine by.
- **909 BD — Attack, Decay and Tune.** Attack is a separate click-level control, not a time; pushing Tune up while shortening Decay is how hard techno kicks are built.
- **909 SD — Tune, Tone and Snappy.** The snare is far more tuneable than the 808's and is often pitched up for rave, down for breakbeat.
- **909 hats — a single shared Decay for closed and open.** Because they are one circuit, an open hat is always choked by a following closed hat. Preserve that behaviour; it is a large part of the groove.
- **Accent.** On both machines accent is one global level applied to whichever steps are marked, not per-voice velocity. Modelling it as a per-step boolean plus one global amount is more faithful than free velocity, and easier to program.

## Electro and early hip hop (808)

The founding 808 idiom. Kick on 1 and the `a` of 2, snare or clap on 2 and 4, 16th maracas or closed hats running throughout, and a cowbell riding the offbeats. Everything is quantised dead straight — the machine feel was the point, not a limitation.

### Electro backbeat — 118 BPM (108–128), swing 50%

The pattern underneath *Planet Rock* and most of the Tommy Boy and Streetwise catalogue.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . X . . . . . x .
SD     . . . . X . . . . . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     x . x . x . x . x . x . x . x .
CB     . . x . . . x . . . x . . . x .
```

Cowbell is the identifying voice. Drop it and the same grid reads as generic drum machine; keep it and it is unmistakably electro. The clap doubles the snare rather than replacing it.

### Electro-funk with maracas — 112 BPM (105–120), swing 50%

The Egyptian Lover / West Coast variant: sparser kick, maracas instead of hats, congas answering the snare.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . x . . x . . . . .
CP     . . . . X . . . . . . . X . . .
MA     x x x x x x x x x x x x x x x x
MC     . . . . . . x . . . . . . . x .
LC     . . . . . . . x . . . . . . . x
CB     . . . . . . . . x . . . . . . .
```

Run the maracas at constant level with accents only on the quarter notes; the 808 maraca is short enough that a full 16th run reads as a shaker groove, not clutter.

### Stripped 808 breakbeat — 104 BPM (96–112), swing 54%

The *Sucker M.C.'s* approach: almost nothing but kick, snare and one hi-hat line, with the snare carrying an extra ghost hit before the backbeat.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . . . X . . . . .
SD     . . . . X . . . . . . x X . . .
CH     x . x . x . x . x . x . x . x x
OH     . . . . . . . . . . . . . . o .
```

A light swing here matters more than in the other two. Straight quantisation makes it sound mechanical; 54–56% gives it the loose feel the records have.

## Miami bass and booty bass (808)

Electro sped up, with the kick decay pushed to maximum so every kick is a sustained sub note. The hi-hats carry the energy at 32nd-note speed and the snare is usually replaced by a clap or a heavily tuned rimshot.

Set BD Decay at or near maximum and BD Tone low. At these tempos a full-decay kick overlaps the next one, which is the intended effect — the sub never stops.

### Bass tempo standard — 135 BPM (125–145), swing 50%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . . . X . . . x .
CP     . . . . X . . . . . . . X . . .
CH     x x x x x x x x x x x x x x x x
OH     . . . . . . . . . . . . . . o .
CB     . . x . . . x . . . x . . . x .
```

### Double-time bass — 145 BPM (140–160), swing 50%

The faster, busier version, with the kick answering itself on the second half of each beat.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . x . . x . X . . x . . x .
SD     . . . . X . . . . . . . X . . .
CH     x x x x x x x x x x x x x x x x
MA     . x . x . x . x . x . x . x . x
CY     X . . . . . . . . . . . . . . .
```

The crash on the downbeat of every fourth bar is part of the style, not a fill — worth exposing as a per-preset option rather than something the user has to draw in.

### Half-time bass groove — 142 BPM (135–150), swing 50%

Backbeat on 3 instead of 2 and 4, which halves the perceived tempo while the hats keep the speed.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . . . . . . x . .
CP     . . . . . . . . X . . . . . . .
CH     x x x x x x x x x x x x x x x x
OH     . . . o . . . . . . . o . . . .
```

## Boom bap and 808-backed hip hop

Here the 808 stops being a drum machine and becomes two separate instruments: a sampled acoustic-sounding kit for the groove, and the 808 kick as a tuned sub-bass underneath it. Most records from *808s & Heartbreak* onward work this way, and a preset should reflect it by treating BD as pitched.

Swing is the defining parameter. Straight 16ths sound wrong; 56–62% is the usable range, and the classic MPC 3000 setting sits around 58%.

### Boom bap — 90 BPM (82–98), swing 58%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . . . X . . . . .
SD     . . . . X . . . . . . . X . . .
CH     x . x x x . x . x . x x x . x .
OH     . . . . . . . . . . . . . . o .
```

The doubled hat on the `a` of 1 and 3 is what makes this swing rather than shuffle. Keep the snare dead on 2 and 4 even with swing engaged — swinging the backbeat drags the whole thing.

### Sparse 808 ballad — 78 BPM (70–88), swing 54%

The *808s & Heartbreak* shape: very few elements, long kick, clap on the backbeat, and space as the main texture.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . . . X . . . . .
CP     . . . . X . . . . . . . X . . .
CH     . . x . . . x . . . x . . . x .
LT     . . . . . . . . . . . . . . x x
```

### Modern 808 hip hop — 84 BPM (78–95), swing 56%

Kick pattern syncopated against the backbeat, with a short pitch glide into the downbeat. `-` marks the held step the glide arrives from.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x - . . x . . . . .
SD     . . . . X . . . . . . . X . . .
RS     . . x . . . . . . . x . . . . .
CH     x . x . x x x . x . x . x x x .
OH     . . . . . . . . o . . . . . . .
```

If the app supports per-step pitch on the BD voice, this is where it earns its place — a two- or three-semitone drop into step 1 is standard.

## Trap (808)

Trap is written at a fast tempo but heard at half of it: the snare lands on beat 3 only, so 140 BPM feels like 70. The 808 kick is played as a bass line with real note pitches and long decay, and the hi-hats carry all the detail through rolls at 32nd and triplet rates.

This is the one family where a 16-step grid is not enough. A preset format needs at least a per-step *ratchet* count (how many times that step retriggers) or a resolution switch on the hat lane.

### Trap standard — 140 BPM (130–160), swing 50%

`3` and `6` on the hat lane mean that step retriggers three or six times within its own duration.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x - . . . . x . . .
SD     . . . . . . . . X . . . . . . .
CP     . . . . . . . . X . . . . . . .
CH     x x x x x x 3 x x x x x x x 6 x
OH     . . . . . . . . . . . o . . . .
```

### Triplet trap — 144 BPM (135–155), swing 66.7%

Full triplet feel on the hats, which is what gives the style its rolling quality. If the app can only swing the grid, 66.7% approximates it closely enough.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . x . . . . . . x . . -
SD     . . . . . . . . X . . . . . . .
CH     x x x x x x x x x x x x x x x x
RS     . . . . . . x . . . . . . . x .
```

### Drill variant — 142 BPM (138–150), swing 58%

The UK and Brooklyn drill kick: a sliding 808 that moves in pitch across three or four steps, with the snare pushed slightly late and the hats sparser than in trap.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X - - . . . . . x - - - . . . .
SD     . . . . . . . . X . . . . . . .
RS     . . . . X . . . . . . . . . . .
CH     x . x . x . 3 . x . x . x . 3 .
```

The slide is the whole identity of drill. If per-step pitch exists, a preset should store a target note per BD step; if not, a glide time parameter applied to consecutive BD hits gets most of the way there.

## Chicago house (909, 808 and 707)

Three rules define the whole family: kick on every quarter, clap or snare on 2 and 4, open hi-hat on every offbeat eighth. Everything else is decoration. The open hat on the `+` is the single most important element — it is what makes four-on-the-floor swing instead of march.

Chicago producers used whatever was in the room, so 808 claps over 909 kicks and 727 percussion over both are historically normal. A preset system that lets voices come from different machines is more faithful than one that locks a kit.

### Basic house — 122 BPM (118–128), swing 50%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     . . x . . . x . . . x . . . x .
OH     . . . . . . . . . . . . . . . .
```

### Open-hat house — 124 BPM (120–130), swing 50%

The defining version. Closed hats on 16ths with the open hat replacing them on every offbeat.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     x . . . x . . . x . . . x . . .
OH     . . o . . . o . . . o . . . o .
```

Set the 909 hat decay medium-long so each open hat rings until the next closed hat chokes it. On an 808 the hats are separate voices and will overlap instead — either accept it or add a choke rule.

### Deep house shuffle — 120 BPM (115–125), swing 57%

The Larry Heard end of the spectrum: swung hats, rimshot filling the gaps, snare much quieter than the clap.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     x . x x x . x x x . x x x . x x
OH     . . o . . . o . . . o . . . o .
RS     . . . . . . . x . . . . . . . x
```

### Jackin' house — 126 BPM (122–132), swing 54%

The kick breaks the four-on-the-floor with an extra hit before beat 3, which is the "jack".

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . x X . . .
CP     . . . . X . . . . . . . X . . .
CH     x . x . x . x . x . x . x . x .
OH     . . o . . . o . . . o . . . o .
CB     . . . . . . x . . . . . . . x .
```

## Acid house (909 + 303)

Rhythmically acid house is house with the decoration stripped away, because the 303 line is doing the work. The drums get simpler, not busier: the point is to leave a hole for the bass to move in. Tom fills between sections are the one flourish, usually rolling down from high to low across a bar.

### Acid basic — 120 BPM (115–128), swing 50%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     x x x x x x x x x x x x x x x x
OH     . . . . . . o . . . . . . . o .
```

Hats on straight 16ths rather than offbeats. Against a 303 the offbeat open hat competes with the bass line's accents; moving it to every other offbeat clears room.

### Acid with tom fill — 122 BPM, swing 50%

Two bars. Bar 1 is the groove, bar 2 replaces the second half with a tom roll — the standard eight-bar transition device.

```
Bar 1  1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     x x x x x x x x x x x x x x x x

Bar 2  1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . . . . .
CP     . . . . X . . . . . . . . . . .
CH     x x x x x x x x . . . . . . . .
HT     . . . . . . . . x . x . . . . .
MT     . . . . . . . . . . . . x . . .
LT     . . . . . . . . . . . . . . x x
```

### Hypnotic acid — 128 BPM (124–135), swing 50%

No clap at all. The backbeat is implied by an open hat rather than stated, which is why long acid tracks can run for minutes without fatigue.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CH     x . x . x . x . x . x . x . x .
OH     . . . . . . . . . . . . o . . .
RS     . . . x . . . . . . . x . . . .
```

## Detroit techno (909)

The Detroit approach moves the clap off the backbeat. Instead of stating 2 and 4, claps fall on syncopated 16ths that pull against the kick, and the ride cymbal — a voice the 808 does not have — runs continuously to hold the pulse. The result is more elastic than Chicago house at the same tempo.

### Detroit syncopated clap — 130 BPM (125–138), swing 50%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . X . . x . . . . X . . .
CH     x . x . x . x . x . x . x . x .
OH     . . o . . . o . . . o . . . o .
RD     x x x x x x x x x x x x x x x x
```

The extra clap on the `a` of 2 is the whole trick. It arrives just before you expect beat 3 and makes the bar lean forward.

### Rolling techno — 133 BPM (128–140), swing 52%

Ride-led, with the kick dropping a step to leave a gap before beat 4.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . . . x .
SD     . . . . X . . . . . . . X . . .
RD     x . x x x . x x x . x x x . x x
OH     . . . . . . . . . . o . . . . .
RS     . . x . . . . . . . . . . x . .
```

### Tom-driven techno — 132 BPM (126–140), swing 50%

Toms as a continuous melodic layer rather than a fill. Tune the three toms to a minor triad if the app allows per-voice pitch.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CP     . . . . . . . . X . . . . . . .
LT     . . x . . . . . . . x . . . . .
MT     . . . . . . x . . . . . . . x .
HT     . . . x . . . . . . . x . . . .
CH     x . x . x . x . x . x . x . x .
```

### Minimal / dub techno — 125 BPM (120–130), swing 50%

Almost nothing on the grid; the space is filled by delay and reverb on the hats and rimshot rather than by more hits.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CH     . . x . . . x . . . x . . . x .
RS     . . . . . . . . . . x . . . . .
OH     . . . . . . . . . . . . . . o .
```

This one is only interesting with effects. If the preset format can store a send level, ship it with a long delay on RS and OH.

## Hard techno, rave and hardgroove (909)

The 909 became the rave machine because its kick survives distortion. Overdriving the BD output turns the pitch envelope into a harmonic click that cuts through on a big system, and the hats get brighter rather than harsher. Patterns here are simple; the aggression comes from the voice settings, not the grid.

Set BD Attack high, Decay medium-short, Tune up a few notches, then saturate. A preset for this family should carry a drive amount.

### Rave stomp — 140 BPM (135–150), swing 50%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
CH     x . x . x . x . x . x . x . x .
OH     . . o . . . o . . . o . . . o .
CP     . . . . X . . . . . . . X . . .
CY     X . . . . . . . . . . . . . . .
```

### Hardgroove — 138 BPM (132–145), swing 54%

The Jeff Mills and Ben Sims lineage: swung ride, percussion filling every gap, kick unvarying underneath.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
RD     x . x x x . x x x . x x x . x x
RS     . . . x . . x . . . . x . . x .
CP     . . . . . . . . X . . . . . . .
OH     . . . . . . . . . . . . o . . .
```

### Offbeat-kick techno — 142 BPM (135–150), swing 50%

The kick skips beat 3 and lands on the `+` instead, which produces the lurching feel of a lot of contemporary hard techno.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . . . X . X . . .
CH     x x x x x x x x x x x x x x x x
OH     . . . . . . o . . . . . . . o .
CP     . . . . . . . . X . . . . . . .
```

### Gabber-adjacent — 165 BPM (155–190), swing 50%

Distorted kick on every 8th rather than every quarter. Historically this is a TR-909 kick pushed through a distortion pedal and resampled, so the preset should sound over-driven by default.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . x . X . x . X . x . X . x .
SD     . . . . . . . . X . . . . . . .
CY     X . . . . . . . . . . . . . . .
```

## UK garage and 2-step (909)

2-step removes the kick from beats 2 and 3 and scatters it, leaving the snare on 2 and 4 as the only fixed point. Heavy shuffle is mandatory — at 50% swing these patterns collapse into generic house. 62–66% is the working range.

### 2-step — 135 BPM (130–140), swing 64%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . x . . x . . . . .
SD     . . . . X . . . . . . . X . . .
CH     x . x x x . x . x . x x x . x .
OH     . . . . . . o . . . . . . . . .
RS     . . . . . . . . . . . x . . . .
```

### Speed garage — 132 BPM (128–138), swing 58%

Closer to house — the kick keeps four-on-the-floor — but with the garage shuffle and a skipping snare.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . X . . . X . . . X . . .
SD     . . . . X . . . . . x . X . . .
CH     x . x x x . x x x . x x x . x x
OH     . . o . . . o . . . o . . . o .
```

### Future garage / bass — 138 BPM (130–145), swing 62%

Half-time snare with a wide-open kick pattern. Shares a tempo with trap but reads completely differently because of the shuffle.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . . . x . . . . .
SD     . . . . . . . . X . . . . . . .
RS     . . . . X . . . . . . . . . x .
CH     x . . x x . . x x . . x x . . x
OH     . . . . . . . . . . . . o . . .
```

Swing on the hats but not on the snare. If the app applies swing globally, consider a per-lane swing bypass — it matters for every style in this section.

## Synth-pop, R&B and pop ballads (808)

The 808's other career. Here it is not driving a dancefloor but sitting under a vocal, so the patterns are slow, quiet and built around the machine's soft voices — rimshot instead of snare, congas instead of toms, and the cowbell used as a hook rather than a timekeeper.

*Sexual Healing* is the template for this whole approach: a slow 808 pattern with rimshot, congas and cowbell, left almost entirely unprocessed, carrying a record that has no other percussion at all.

### Slow 808 soul — 94 BPM (88–102), swing 56%

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . . . X . . . . .
RS     . . . . X . . . . . . . X . . .
CB     . . x . . . . . . . x . . . . .
MC     . . . . . . x . . . . . . . x .
LC     . . . . . . . x . . . . . . . x
MA     x . x . x . x . x . x . x . x .
```

Keep everything under the rimshot in level. The pattern only works if it sounds like a bed rather than a beat.

### Synth-pop mid-tempo — 116 BPM (108–124), swing 50%

The early-eighties new wave use: straight, dry, clap doubling the snare, hats on eighths.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . X . . . . . . .
SD     . . . . X . . . . . . . X . . .
CP     . . . . X . . . . . . . X . . .
CH     x . x . x . x . x . x . x . x .
CY     X . . . . . . . . . . . . . . .
```

### Contemporary R&B — 72 BPM (64–82), swing 60%

Half-time, sparse, with the 808 kick used as a pitched bass note and finger-snap-style claps on the backbeat.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . . . x - . . . .
CP     . . . . . . . . X . . . . . . .
CH     . . x . . . x . . . x . . x x .
RS     . . . . . . . . . . . . . . x .
```

## Dancehall, dembow and reggaeton (808)

All three rest on the same asymmetric kick figure: 3+3+2. Across 8 steps the kick falls on steps 1, 4 and 7, then repeats. Almost every Caribbean-derived electronic rhythm is a variation on this, and it is worth exposing as its own preset category because it behaves differently from everything above.

```
The 3+3+2 cell, 8 steps:
       1 e + a 2 e + a
BD     X . . x . . x .
```

### Dembow — 96 BPM (88–104), swing 50%

The boom-ch-boom-chick pattern. Snare on the `a` of 1 and on 2 and 4, kick on the 3+3+2.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . x . . x . X . . x . . x .
SD     . . . . X . . x . . . . X . . x
CH     x . x . x . x . x . x . x . x .
```

### Reggaeton — 92 BPM (85–100), swing 50%

Same kick, but the snare pattern is lighter and a shaker or maraca layer runs on 16ths.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . x . . x . X . . x . . x .
SD     . . . x . . . x . . . x . . . x
MA     x x x x x x x x x x x x x x x x
OH     . . . . . . . . . . . . . . o .
```

### Dancehall — 100 BPM (90–110), swing 54%

Sparser, with the emphasis on beat 3 and a rimshot answering the kick. The *Sleng Teng* lineage sits here, though that riddim itself came off a Casio MT-40 preset rather than an 808.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . X . . x . . . .
RS     . . . . X . . . . . . . X . . .
CH     x . x x x . x . x . x x x . x .
MC     . . . . . . x . . . . . . . x .
```

### Afrobeats / amapiano-adjacent — 112 BPM (105–118), swing 56%

A 3+3+2 kick with the log-drum-style low percussion on the offbeats and a much busier shaker layer.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . x . . x . X . . . . . x .
RS     . . . . X . . . . . . . X . . .
LC     . . x . . x . . . . x . . x . .
MA     x x . x x x . x x x . x x x . x
CH     . . x . . . x . . . x . . . x .
```

## Breakbeat and big beat

These styles originate in sampled acoustic breaks rather than drum machines, but 808 and 909 voices are routinely layered underneath — the machine supplies the kick weight and the break supplies the swing. Programming the break shape onto machine voices gives a usable approximation.

### Machine breakbeat — 130 BPM (125–140), swing 54%

The *Funky Drummer*-derived shape written for two voices: kick, snare, and ghost snares between them.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . . . . x . . . .
SD     . . . x X . . . . x . . X . . x
CH     x . x . x . x . x . x . x . x .
OH     . . . . . . . . . . . . . . o .
```

The ghost snares (`x` on steps 4, 10 and 16) should sit well below the accented backbeat. If the app has only one accent level, drop the ghosts to a separate quieter voice.

### Big beat — 122 BPM (110–135), swing 56%

Slower, heavier, with a 909 kick doubling the break and a crash landing on the downbeat of each phrase.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . x . X . . . . . . .
SD     . . . . X . . . . . . x X . . .
CH     x . x x x . x . x . x x x . x .
CY     X . . . . . . . . . . . . . . .
```

### Jungle-adjacent half-time — 168 BPM (160–176), swing 52%

At jungle tempos the 808 kick becomes the sub and the breakbeat runs on top. The bar below is the sub layer only — the machine part of a jungle track, not the break itself.

```
       1 e + a 2 e + a 3 e + a 4 e + a
BD     X . . . . . . . . . x . . . . .
SD     . . . . . . . . X . . . . . . .
RS     . . . . . . x . . . . . . . x .
CH     x . x . x . x . x . x . x . x .
```

## Fills, variations and humanisation

A preset that plays one identical bar forever gets old in about thirty seconds. Both machines addressed this with an A/B pattern pair and a fill button, and that is still the cheapest way to make presets feel alive.

### Deriving a B-pattern automatically

Given any A-pattern, these four rules produce a usable variation without the user drawing anything:

1. Remove the last kick of the bar and add one on the `a` of 4.
2. Add one extra open hat on a step that currently has a closed hat.
3. Add a ghost snare or rimshot on the `e` of 3.
4. Leave the backbeat alone.

Play A A A B on a four-bar cycle. For a longer cycle, A A A B A A A F where F is a fill.

### Fill templates

Fills replace the last one or two beats of the bar. These three cover most of what the machines were used for.

| Fill | Steps used | Voices | Fits |
| --- | --- | --- | --- |
| Tom roll down | 13–16 | HT, MT, LT descending | Acid, techno, electro |
| Snare rush | 13–16 | SD on all four, accent on 16 | House, rave, breakbeat |
| Hat stutter | 15–16 | CH retriggered 4–6 times | Trap, drill, garage |

A crash on step 1 of the bar after any fill is near-universal and should probably be automatic.

### Accent placement

Both machines have one accent level shared across all voices, which constrains where accents are musically useful. Two rules cover most cases:

- Accent the downbeat of each beat on four-on-the-floor patterns, so every kick is accented and any hat sharing that step comes along with it.
- Accent only steps 1 and 9 on backbeat patterns, which leaves the snare unaccented and makes the kick feel heavier than it is.

Accent amount around 60–70% of the available range sounds like the hardware. At maximum the difference between accented and unaccented steps stops reading as dynamics and starts reading as two different sounds.

### Humanisation

The machines were rigidly quantised, so heavy timing randomisation makes presets sound less authentic, not more. Useful amounts:

- Timing: 0 for house, techno and electro. 1–3 ms of random jitter on hats only for hip hop and garage.
- Velocity: ±5% on hats and percussion, 0 on kick and snare.
- Swing: apply to hats and percussion lanes only, never to kick or snare.

## Suggested preset format

A shape that holds everything in this document, including the awkward cases — ratchets, pitch slides, per-lane swing and cross-machine kits.

```json
{
  "id": "electro-backbeat",
  "name": "Electro Backbeat",
  "category": "Electro",
  "machine": "TR-808",
  "tempo": 118,
  "tempoRange": [108, 128],
  "swing": 0.50,
  "steps": 16,
  "accentAmount": 0.65,
  "lanes": [
    {
      "voice": "BD",
      "machine": "TR-808",
      "steps": [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0],
      "accents": [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
      "params": { "tune": 0.5, "decay": 0.7, "tone": 0.4, "level": 0.9 }
    },
    {
      "voice": "CH",
      "machine": "TR-808",
      "steps": [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      "ratchets": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "swingBypass": false,
      "params": { "decay": 0.3, "level": 0.6 }
    }
  ],
  "variation": { "mode": "AAAB", "fill": "tomRollDown", "crashAfterFill": true }
}
```

Notes on the fields that are not obvious:

| Field | Why it exists |
| --- | --- |
| `machine` on each lane | Chicago and Detroit records routinely mixed 808 claps with 909 kicks; locking a whole preset to one machine is less faithful than allowing a per-voice choice |
| `accents` as a parallel array | Matches the hardware's single global accent rather than free per-step velocity |
| `accentAmount` at preset level | The one global control both machines had |
| `ratchets` | Non-zero means that step retriggers that many times; required for trap, drill and garage |
| `swingBypass` per lane | Kick and snare lanes normally ignore swing while hats follow it |
| `tempoRange` | Lets the app warn or adapt when a preset is dragged far outside its idiom |

For pitched kick lanes, add `"notes"` as a parallel array of semitone offsets from the lane's `tune`, with `null` for rests, and a `"glide"` value in milliseconds applied when consecutive steps both carry notes. That single addition covers every trap and drill pattern in this document.

If you would rather keep the format flat, the grids here also survive as strings — `"BD": "X..... x.X..... x."` parses cleanly and is far easier to hand-edit while prototyping. Converting to arrays later is trivial; converting a badly-designed array format is not.

## Reference listening

Tracks worth pulling up while tuning each preset, with the thing to listen for. These are illustrative of the style, not the source of the grids above.

| Track | Artist | Year | Machine | Listen for |
| --- | --- | --- | --- | --- |
| Planet Rock | Afrika Bambaataa & Soulsonic Force | 1982 | 808 | The cowbell riding offbeats under the whole record |
| Sexual Healing | Marvin Gaye | 1982 | 808 | Rimshot and congas doing a full kit's work at low level |
| Sucker M.C.'s | Run-D.M.C. | 1983 | 808 | How few voices are actually playing |
| Egypt, Egypt | The Egyptian Lover | 1984 | 808 | Maraca layer and the conga answers |
| Acid Tracks | Phuture | 1987 | 909 + 303 | Drums thinning out to make room for the bass line |
| Strings of Life | Rhythim Is Rhythim | 1987 | — | Syncopated clap placement, the Detroit signature |
| Energy Flash | Joey Beltram | 1990 | 909 | Kick saturation and the open-hat offbeat |
| Higher State of Consciousness | Josh Wink | 1995 | 909 | Rave-tempo hat programming |
| Da Funk | Daft Punk | 1995 | 909 | Kick weight against a filtered lead |
| Bug in the Bassbin | Innerzone Orchestra | 1992 | — | Break-derived programming at techno tempo |
| Sound of da Police | KRS-One | 1993 | 808-era | Swing amount on a boom bap kit |
| Love Lockdown | Kanye West | 2008 | 808 | 808 kick treated as the bass part |
| Hard in da Paint | Waka Flocka Flame | 2010 | 808 | Hi-hat roll placement and half-time snare |
| Gasolina | Daddy Yankee | 2004 | 808 | The 3+3+2 kick in its clearest form |
| Rhythm Is a Dancer | Snap! | 1992 | 909 | Straightforward rave-era house programming |

Machine attributions for individual records are frequently disputed, since studios layered machines, samples and outboard freely, and few sessions were documented. Where the machine is uncertain or the record used a sampler emulating one, the column is left blank.

## On accuracy and naming

The grids in this document are idiomatic patterns for each style, written from how the style works rather than transcribed from any particular recording. That is deliberate and it is also the safer footing for a shipping product.

Rhythm patterns as such are generally not protectable — a backbeat or a four-on-the-floor kick is a building block, not a work. What does create exposure is naming: a preset called after a song or an artist invites the claim that you are trading on it, even when the underlying grid is generic. Name presets after the style ("Electro Backbeat", "Deep House Shuffle") rather than after records, and keep the reference listening table as internal documentation rather than shipping it as preset labels.

"TR-808" and "TR-909" are Roland trademarks. Describing a preset as *808-style* or listing the voice names is normal industry practice, but presenting the app as being a Roland product, or using the Roland logo or the machines' distinctive orange-and-yellow button styling, is a different matter. If this ships commercially, that is the question worth a lawyer's half hour — not the patterns.

Two details in this document are worth verifying against a source before you rely on them in marketing copy: individual machine attributions in the reference table, and the exact classic MPC swing percentages. Both are widely repeated online and inconsistently reported.

I wrote this from knowledge rather than from sources, so treat the dates and attributions as approximate. If you want, I can check the disputed ones against published interviews and equipment histories.
