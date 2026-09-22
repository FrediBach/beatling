export interface SynthNote {
  output: GainNode;
  start: number;
  end: number;
  from: number;
  target: number;
  glideEnd: number;
  incomingPitch: number | null;
  fadeStart: number;
  fadeEnd: number;
  fadeLevel: number;
}

const MAX_SYNTH_NOTES = 256;
const RETRIGGER_FADE = 0.005;

/** One bank per synth voice, shared by all of its sequencer/routing sources. */
export class SynthArticulation {
  private notes: SynthNote[] = [];
  private last: SynthNote | null = null;

  begin(context: AudioContext, destination: AudioNode, time: number, duration: number, frequency: number, mono: boolean, glide: number): SynthNote | null {
    this.prune(context.currentTime);
    if (this.notes.length >= MAX_SYNTH_NOTES) return null;
    const previous = this.last && this.last.start <= time && this.last.end > time ? this.last : null;
    // Multiple routes can hit the same timestamp. Carry the pitch from before
    // that timestamp, never from an unheard note that is being superseded.
    const incomingPitch = previous ? previous.start === time ? previous.incomingPitch : this.pitchAt(previous, time) : null;
    const slide = mono && incomingPitch !== null ? Math.max(0, Math.min(0.5, glide)) : 0;
    const from = slide > 0 && incomingPitch !== null ? Math.min(context.sampleRate * 0.49, Math.max(1, incomingPitch)) : frequency;
    if (mono) {
      for (const note of this.notes) {
        if (note.start > time || note.end <= time || note.fadeStart <= time) continue;
        // Last scheduled hit wins at the same timestamp, without a doubled attack.
        this.fade(note, time, note.start === time ? 0 : RETRIGGER_FADE);
      }
    }
    const output = context.createGain();
    output.gain.setValueAtTime(1, time);
    output.connect(destination);
    const note = { output, start: time, end: time + duration, from, target: frequency, glideEnd: time + slide, incomingPitch, fadeStart: Infinity, fadeEnd: Infinity, fadeLevel: 1 };
    this.notes.push(note);
    this.last = note;
    return note;
  }

  private pitchAt(note: SynthNote, time: number): number {
    if (time >= note.glideEnd) return note.target;
    const progress = Math.max(0, (time - note.start) / (note.glideEnd - note.start));
    return note.from * (note.target / note.from) ** progress;
  }

  prune(now: number): void {
    this.notes = this.notes.filter((note) => {
      if (note.end > now) return true;
      note.output.disconnect();
      return false;
    });
    if (this.last && this.last.end <= now) this.last = null;
  }

  reset(now: number): void {
    for (const note of this.notes) {
      if (note.end <= now) note.output.disconnect();
      else this.fade(note, now, note.start >= now ? 0 : RETRIGGER_FADE);
    }
    this.notes = [];
    this.last = null;
  }

  private fade(note: SynthNote, time: number, duration: number): void {
    const level = time >= note.fadeEnd ? 0 : time >= note.fadeStart
      ? note.fadeLevel * (note.fadeEnd - time) / (note.fadeEnd - note.fadeStart) : 1;
    note.output.gain.cancelScheduledValues(time);
    note.output.gain.setValueAtTime(duration === 0 ? 0 : level, time);
    if (duration > 0) note.output.gain.linearRampToValueAtTime(0, time + duration);
    note.fadeStart = time;
    note.fadeEnd = time + duration;
    note.fadeLevel = level;
    note.end = Math.min(note.end, note.fadeEnd);
  }
}
