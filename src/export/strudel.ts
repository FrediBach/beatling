import { quantizeVoiceCv } from "@/lib/quantizer";
import { rhythmsFor } from "@/lib/rhythm-series";
import type { Patch, RhythmPattern, SequencerBlock, VoiceId } from "@/lib/types";
import { hasSoloedVoices, isVoiceAudible } from "@/lib/voice-audibility";

const SOUND_NAMES: Record<Exclude<VoiceId, "bassline" | "lead">, string> = {
  kick: "bd",
  snare: "sd",
  clap: "cp",
  rim: "rim",
  ch: "hh",
  oh: "oh",
  lt: "lt",
  mt: "mt",
  ht: "ht",
  cow: "cb",
  cym: "cr",
  shk: "sh",
};

const number = (value: number) => Number(value.toFixed(4)).toString();

function voiceSource(patch: Patch, block: SequencerBlock): string {
  if (block.kind === "bernoulli") {
    const [a, b] = block.branchVoices.map((voice) => SOUND_NAMES[voice as keyof typeof SOUND_NAMES] ?? "bd");
    return `s(wchoose(["${a}", ${block.prob}], ["${b}", ${100 - block.prob}]))`;
  }

  const id = block.voice as VoiceId;
  const voice = patch.voices[id];
  if (id === "bassline" || id === "lead") {
    const midi = quantizeVoiceCv(voice.custom, 0, voice.tune).midi;
    const waveform = id === "bassline"
      ? (voice.custom.waveform >= 0.5 ? "square" : "sawtooth")
      : (["sawtooth", "square", "triangle"][Math.round(voice.custom.waveform)] ?? "sawtooth");
    return `note("${number(midi)}").s("${waveform}").lpf(${number(voice.custom.cutoff)})`;
  }

  const sound = SOUND_NAMES[id as keyof typeof SOUND_NAMES] ?? "bd";
  const bank = voice.machine === "808" ? ".bank(\"RolandTR808\")" : voice.machine === "909" ? ".bank(\"RolandTR909\")" : "";
  return `s("${sound}")${bank}`;
}

function rhythmPattern(source: string, rhythm: RhythmPattern, block: SequencerBlock, patch: Patch): string {
  const duration = rhythm.steps * block.div / (patch.rate * 4);
  return `${source}.euclidRot(${rhythm.pulses}, ${rhythm.steps}, ${rhythm.rot})${duration === 1 ? "" : `.slow(${number(duration)})`}`;
}

function blockPattern(patch: Patch, block: SequencerBlock): string {
  const source = voiceSource(patch, block);
  const rhythms = rhythmsFor(block);
  const patterned = rhythms.length === 1
    ? rhythmPattern(source, rhythms[0], block, patch)
    : `arrange(\n${rhythms.map((rhythm) => {
      const duration = rhythm.steps * block.div / (patch.rate * 4) * rhythm.repeats;
      return `      [${number(duration)}, ${rhythmPattern(source, rhythm, block, patch)}]`;
    }).join(",\n")}\n    )`;
  const id = block.kind === "bernoulli" ? block.branchVoices[0] : block.voice as VoiceId;
  const voice = patch.voices[id];
  const chance = block.kind === "voice" && block.prob < 100 ? `.degradeBy(${number(1 - block.prob / 100)})` : "";
  const gain = `.gain(${number((patch.vol / 100) * (voice.level / 100))})`;
  return `${patterned}${chance}${gain}`;
}

export function buildStrudel(patch: Patch): string {
  const soloActive = hasSoloedVoices(patch.voices);
  const blocks = patch.blocks.filter((block) => {
    if (block.mute || !rhythmsFor(block).some((rhythm) => rhythm.pulses > 0)) return false;
    if (block.kind === "bernoulli") return block.branchVoices.some((id) => isVoiceAudible(patch.voices, id, soloActive));
    return block.kind === "voice" && block.voice && isVoiceAudible(patch.voices, block.voice, soloActive);
  });
  const patterns = blocks.map((block) => blockPattern(patch, block));
  const routingNote = patch.blocks.some((block) => block.clk.some((source) => source !== "G") || block.rst || block.mut || block.modulations.length)
    || Object.values(patch.voices).some((voice) => voice.modulations.length)
    ? "// Routing, resets, mute inputs, and modulation are not portable to Strudel.\n"
    : "";
  const swing = patch.swing > 0 ? `\n  .swingBy(${number(patch.swing / 100)}, ${patch.rate * 2})` : "";

  return `// Beatling → Strudel
setcpm(${number(patch.bpm / 4)})
${routingNote}${patterns.length ? `stack(\n${patterns.map((pattern) => `  ${pattern}`).join(",\n")}\n)${swing}` : "silence"}
`;
}
