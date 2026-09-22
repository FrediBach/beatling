import type { VoiceBank, VoiceId } from "@/lib/types";

export function hasSoloedVoices(voices: VoiceBank): boolean {
  return Object.values(voices).some((voice) => voice.solo);
}

export function isVoiceAudible(voices: VoiceBank, id: VoiceId, soloActive = hasSoloedVoices(voices)): boolean {
  const voice = voices[id];
  return !voice.mute && (!soloActive || voice.solo);
}
