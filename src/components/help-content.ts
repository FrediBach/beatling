export interface HelpChapter {
  id: string;
  label: string;
  title: string;
  intro: string;
  cards: { title: string; text: string }[];
  tip: string;
}

export const HELP_CHAPTERS: HelpChapter[] = [
  {
    id: "start", label: "Start here", title: "A little pattern. A whole lot of rhythm.",
    intro: "Beatling spreads hits around a loop for you. Layer a few loops, give them sounds, and turn a repeating beat into something that keeps surprising you.",
    cards: [
      { title: "01 / Press play", text: "Choose Load demo or a factory preset, then press Play. Tempo sets the speed in beats per minute; Clock rate sets the pulse feeding the sequencers. Start at 1/16. Swing delays alternating clock pulses for a looser feel; Volume sets the overall output." },
      { title: "02 / Make one change", text: "Each of the 16 numbered blocks is an independent sequencer. Choose its voice at the top. Drag Fill up or down to change the number of hits, then try Rotate to shift where they land. Mute a block to hear what it contributes." },
      { title: "03 / Find your view", text: "Grid shows all 16 blocks. Circle layers their rhythms as rings: select a ring to edit that block, and switch the sidebar between Rhythm settings and Voice bank. Patch cables reveals connections; hiding cables leaves the routing active." },
      { title: "04 / Keep exploring", text: "Stop ends playback; Play starts the sequences again from the beginning. Reset all blocks brings their playheads and rhythm series back to the beginning. Undo and Redo let you revisit patch edits. The sun/moon button changes the theme. Open Build a beat for a recipe from a blank pattern." },
    ],
    tip: "No sound? Press Play, raise Volume and the voice level, check block and voice mutes, then check Fill, Chance, and the block’s Clock in. A Modulator makes control signals, not sound.",
  },
  {
    id: "rhythm", label: "Rhythm", title: "Five controls. Countless grooves.",
    intro: "A Euclidean rhythm distributes a chosen number of hits as evenly as possible across a loop. The spaces between the hits are as useful as the hits themselves.",
    cards: [
      { title: "Steps + Fill", text: "Steps is the loop length, from 1 to 32. Fill is the number of hits, from zero (silent) to every step. With 16 steps and 4 hits, you get a steady pulse every four steps. Try 5 hits over 16 steps for uneven gaps that still repeat predictably." },
      { title: "Rotate + Divide", text: "Rotate moves the pattern around the loop without changing its hit count. Divide advances the block once per chosen number of incoming clocks: 2 is half as fast as 1. With a 1/16 global clock and Divide 1, 16 steps span one four-beat bar." },
      { title: "Chance + mute", text: "Chance is the probability that a filled step plays: 100% always, 50% roughly half the time. It does not add hits to empty steps. Block mute silences that lane; voice mute silences every lane using that sound. Bernoulli gates use Chance differently—see Patch & modulate." },
      { title: "Rhythm series", text: "The stacked-layers button opens up to eight ordered rhythms per block. Set Steps, Fill, Rotate and 1–16 cycle repeats for each, then add, reorder or remove entries. The next rhythm starts after the current one finishes its repeats; the series loops. Voice, Divide, Chance and routing are shared by the whole series." },
      { title: "Dice with intention", text: "A row’s dice randomizes that parameter; the header dice randomizes the block. Shuffle changes unlocked pattern settings across the grid while preserving routing. Lock one parameter, a whole block, or all settings. Locks protect against randomization; you can still edit by hand." },
      { title: "A musical starting point", text: "Musical randomizer asks about groove, activity, syncopation, swing, and phrase development. Create a new drum, bass, and lead groove, or reshape eligible parts of your current patch. Choose instruments and a shared key, or keep existing tuning. Keep protects a complete part and its routing dependencies. New grooves preserve locked slots; Reshape honors individual parameter locks. Complex routed parts stay intact. Listen and try several ideas without saving; Apply commits one undoable change to the current variation. Preview pauses song playback, and closing restores your patch with playback stopped." },
      { title: "Read and edit", text: "Filled dots are hits, hollow dots are rests, and the highlighted position is the playhead. Drag a parameter vertically, use the wheel, or focus it and press arrow keys; Shift + arrows changes by four. Modulated rows show the base value, signed depth and current result. Clear replaces the active patch with an empty one; Undo can restore it." },
    ],
    tip: "Unequal loop lengths create evolving relationships. Try a 15-step percussion loop against a 16-step kick, then use Reset in → every bar if you want the shorter loop to realign each bar.",
  },
  {
    id: "sound", label: "Sound & FX", title: "Give every layer its own space.",
    intro: "The voice bank is shared: several blocks can trigger the same sound. Editing that voice changes the sound for all of them.",
    cards: [
      { title: "Twelve drums, two synths", text: "Choose kick, snare, clap, rim, closed/open hats, three toms, cowbell, cymbal or shaker, plus a 303-inspired Bassline and 101-inspired Lead. Drum model buttons cycle 808, 909 and custom synthesis. Each voice has its own level and mute; the bank’s mute control handles all voices together." },
      { title: "Shape the instrument", text: "Open a voice’s settings to change Tune (semitones) and Decay (short to long). Custom drums expose sound-specific tone, transient, noise and envelope controls. Bassline and Lead expose their synthesis controls and pitch quantizer. Reset synthesis restores those synthesis settings while keeping tune, decay, level and routing." },
      { title: "Melodies from modulation", text: "In a synth’s settings, choose a root and scale. In the voice’s Patch dialog, add a V/Oct route from a block’s LFO. The positive control signal spans one octave at full depth and snaps to the selected scale; Tune transposes after quantization. A random source makes stepped melodic choices." },
      { title: "Hear an effect", text: "Open Effects, choose a processor and enable it. Raise a voice’s send and the effect’s Return level. All three are needed. Sends feed shared processors alongside the dry sound, so one reverb can put several voices in the same space. Bypass keeps your settings and sends." },
      { title: "Grit and space", text: "Distortion offers soft saturation, hard clipping and wavefolding; balance Drive with Tone and Output trim. Reverb offers short Room, Studio and long Hall tails. Pre-delay separates the room from the attack, Damping darkens the tail and Low cut keeps bass clear. Changing space starts a fresh tail." },
      { title: "Echoes and resonance", text: "Delay offers free time up to two seconds or tempo sync with straight, dotted and triplet notes. Feedback controls repeats; Tone and Low cut shape each repeat. Karplus–Strong excites a String or Tube resonator. Tune and Octave range from echoes to high pitches; Excitation softens the strike, Body brightens the tail and Decay extends its ringing." },
      { title: "Parallel punch", text: "Compressor Threshold and Ratio set the squeeze; Knee softens its onset. Attack lets transients through and Release sets recovery. Makeup lifts the compressed signal, then Return blends it with your dry voices. The curve shows compression before makeup gain." },
      { title: "Precise FX adjustments", text: "Drag a dial vertically; hold Shift for fine control. Click a numeric readout to type a value, or double-click a control to reset it. Processor Reset restores its parameters; Clear sends removes its voice feeds. Reset effects restores the whole effects setup." },
    ],
    tip: "Keep the kick fairly dry, shorten busy hats, and send a little clap or rim to reverb. Lower a competing layer before reaching for more master volume.",
  },
  {
    id: "patch", label: "Patch & modulate", title: "Let one rhythm move another.",
    intro: "Open Patch on the receiving block or voice to choose its inputs. A trigger is a momentary event, a gate stays active for a duration, and an LFO is a repeating control signal.",
    cards: [
      { title: "Clock in → when to advance", text: "G is the global clock. Numbered sources are other blocks’ trigger outputs. Multiple clock sources add together; remove G to let another block drive the lane alone. With no source selected, the lane does not advance. Divide counts these incoming clocks." },
      { title: "Reset, mute and gate", text: "Reset in restarts the receiving block at the first step and first rhythm, either every bar or on another block’s trigger. Mute in suppresses hits while the source’s gate is active. Gate sets output duration as a percentage of the step interval; it is not the voice’s Decay control." },
      { title: "A dedicated Modulator", text: "Choose Modulator in a block’s voice menu, set a rhythm and open Patch to pick ramp, triangle, square or random under LFO out. Each filled step starts a waveform cycle that lasts until the next hit. Random chooses a value at each hit and holds it. Divide stretches the timing. Fill 0 gives a neutral midpoint." },
      { title: "Source → target → depth", text: "In the receiving block’s Modulation in, add a route, choose a source and target, then set depth. Targets are Fill, Rotate, Chance, Divide, voice Tune, Decay and Level. Each target has one route with its own depth. Positive depth follows the waveform; negative depth reverses it; zero has no effect. Start small and watch the live readouts." },
      { title: "Block or voice modulation?", text: "A block’s voice targets affect hits from that block. The voice bank’s Patch applies Tune, Decay and Level modulation to the shared voice, with V/Oct also available for synths. The two contributions combine. Voice blocks also supply LFOs, stepped across their pattern; dedicated Modulators cycle between Euclidean hits. Chance and mute affect their triggers, not the Modulator waveform." },
      { title: "Bernoulli: one hit, two choices", text: "Choose Bernoulli gate, then select output voices A and B in Patch. Every filled step chooses A at the Chance percentage, otherwise B: 70% means about seven A hits out of ten, not 30% silence. Divide, mute and routing still apply. The chosen event also supplies the block’s trigger and gate outputs." },
    ],
    tip: "Turn on Patch cables to trace trigger, gate and modulation routes. Socket counts and hover descriptions explain the connections; select a block connection in the patch bay to follow it.",
  },
  {
    id: "build", label: "Build a beat", title: "From a pulse to a pocket.",
    intro: "Start with Clear in pattern mode, set Clock rate to 1/16, Tempo to 120, and Swing to 0. Use four voice blocks with global clock G, Divide 1 and Chance 100%. Leave the remaining blocks silent.",
    cards: [
      { title: "01 / Establish the anchor", text: "Use the recipe above for a four-on-the-floor foundation. The kick marks every beat, the clap lands on beats two and four, and the closed hat sits between beats. Add the rim last and turn its voice level down so it feels like a conversation around the main beat." },
      { title: "02 / Make it breathe", text: "Raise Swing gradually and listen to the hats. Shorten their Decay if the groove feels crowded. Try rim Chance around 65% for occasional gaps, keeping the kick at 100%. Rotate the rim one step at a time and listen for the version that leaves room for the clap." },
      { title: "03 / Break the symmetry", text: "For a rolling alternative, change the kick to 5 hits over 16 steps. For a longer evolving phrase, try the rim at 5 hits over 15 steps with no bar reset. Keep another layer on 16 steps as a reference. Change one relationship at a time so you can hear why it works." },
      { title: "04 / Build a fill", text: "Open the hat’s rhythm series. Keep the first rhythm for 3 cycles, then add a 16-step rhythm with Fill 12 for 1 cycle. With Divide 1 and the 1/16 clock, that makes a four-bar phrase with a busy final bar. Reset all blocks to hear the phrase from its start." },
      { title: "05 / Add controlled movement", text: "Set an unused block to Modulator: Steps 16, Fill 1, Divide 4, triangle. Route it to the hat’s voice Decay with a small depth. For alternate percussion colors, try a Bernoulli block with rim as A and cowbell as B. Listen before adding a second modulation route." },
      { title: "06 / Turn a loop into a track", text: "Duplicate A into B, then change one thing: add an open hat, raise a send or use a denser fill. Make C a breakdown by muting the kick. In Song, arrange A → B → C → B with 4, 4, 2 and 4 bars. Keep A as your reference and compare changes before adding more layers." },
    ],
    tip: "A useful pro constraint: keep one anchor, one answering rhythm and one moving texture. Lock what works, then randomize just the part that needs a new idea.",
  },
  {
    id: "arrange", label: "Arrange", title: "Think in patterns. Play in phrases.",
    intro: "Rhythm series develop individual lanes. Variations capture whole patches. Song parts decide which variation plays, and for how many bars.",
    cards: [
      { title: "A is your reference", text: "The + beside the variation tabs duplicates the selected variation. Each variation has its own full patch and independent undo history. Changed settings are highlighted relative to A, making it easier to see what makes B or C different. A stays as the comparison base. Delete another variation with its trash button; this also removes its song parts." },
      { title: "Build a song", text: "Creating a variation also adds it to the song. Turn on Song to see the timeline. Select a part and use + to insert that pattern again; set its length with the minus/plus bar controls (1–16 bars). A pattern can appear in several song parts. Editing that variation changes every part that references it." },
      { title: "Shape the order", text: "Drag parts to reorder them, or focus a part and use Alt + Left/Right. Select a part to work on it; remove it with the trash button. During playback, Song advances through the parts by their bar counts and loops the arrangement. Turn Song off to return to pattern editing." },
      { title: "Perform and compare", text: "Mute layers, switch variations, change voice levels or tweak effects as you play. Undo/Redo covers patch edits within the current variation; it is not a history of song-part ordering or deletion. Save an arrangement file before major structural changes." },
    ],
    tip: "A 16-step rhythm is one bar only at a 1/16 clock with Divide 1. Other lengths, divisions and routed clocks can span several bars. Song restarts the block patterns when it advances to a new part; use bar reset routing for alignment within a part.",
  },
  {
    id: "save", label: "Save & keys", title: "Keep the session. Take the rhythm.",
    intro: "Your session saves automatically in this browser when storage is available. Use an arrangement file for a portable copy of variations and song structure.",
    cards: [
      { title: "Presets, files and folders", text: "The Presets menu loads factory arrangements; Load demo restores the demo session. Save writes the complete arrangement as JSON; Load opens a preset file. Sync folder adds JSON presets from a folder to the menu, and Resync refreshes it. File controls require a browser with File System Access support and may be disabled elsewhere." },
      { title: "JSON: the editable patch", text: "Export → JSON copies the active patch, including voices, effects, routes and rhythm series. Paste a patch into the text area and choose Load JSON to import it into the current variation. This export does not include the other variations or the song timeline; use Save for the full arrangement." },
      { title: "MIDI: take it to a DAW", text: "Export → MIDI → Download .mid creates a multi-track note file with tempo, swing, gate length and rhythm series. Chance and Bernoulli choices are baked into a repeatable render. It spans at least four bars, extends for longer series and caps at 64 bars. It carries notes, not Beatling’s audio, effects or live routing/modulation graph." },
      { title: "Strudel + Lua", text: "Strudel export provides playable code for direct Euclidean voice lanes, series, tempo, swing, chance, levels and 808/909 bank choices. Lua provides a data table for the Euclid Grid example in Luading, not a complete standalone script. These formats are translations; MIDI and Strudel do not reconstruct live clock/reset/mute routing or modulation. Export works on the active patch, not the whole song." },
    ],
    tip: "Browser storage is local to this browser and can be cleared. Keep a saved arrangement file for sessions you want to return to; in browsers without file controls, copy JSON for each patch you need to keep.",
  },
];
