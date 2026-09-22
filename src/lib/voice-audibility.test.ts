import { describe, expect, it } from "vitest";
import { createVoices } from "@/lib/patch";
import { hasSoloedVoices, isVoiceAudible } from "@/lib/voice-audibility";

describe("voice audibility", () => {
  it("allows unmuted voices when no solo is active", () => {
    const voices = createVoices();
    voices.snare.mute = true;

    expect(hasSoloedVoices(voices)).toBe(false);
    expect(isVoiceAudible(voices, "kick")).toBe(true);
    expect(isVoiceAudible(voices, "snare")).toBe(false);
  });

  it("allows multiple solos while mute continues to win", () => {
    const voices = createVoices();
    voices.kick.solo = true;
    voices.snare.solo = true;
    voices.snare.mute = true;

    expect(hasSoloedVoices(voices)).toBe(true);
    expect(isVoiceAudible(voices, "kick")).toBe(true);
    expect(isVoiceAudible(voices, "snare")).toBe(false);
    expect(isVoiceAudible(voices, "clap")).toBe(false);
  });
});
