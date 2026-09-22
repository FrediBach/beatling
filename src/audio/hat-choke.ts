interface OpenHat {
  node: GainNode;
  start: number;
  end: number;
  fadeStart: number;
  fadeEnd: number;
  fadeLevel: number;
}

// A pathological routed patch must not retain unbounded per-hit choke gates.
const MAX_OPEN_HATS = 128;
const SAME_HIT_EPSILON = 0.000001;

/** Audio-time choke gates before the dry/effect-send split. No wall-clock timers. */
export class HatChoke {
  private hats: OpenHat[] = [];
  private lastClosed = -Infinity;

  open(context: AudioContext, destination: AudioNode, time: number, duration: number): GainNode | null {
    this.prune(context.currentTime);
    // Closed wins a simultaneous pair in either block/routing traversal order.
    if (Math.abs(time - this.lastClosed) < SAME_HIT_EPSILON || this.hats.length >= MAX_OPEN_HATS) return null;
    const node = context.createGain();
    node.gain.setValueAtTime(1, time);
    node.connect(destination);
    this.hats.push({ node, start: time, end: time + duration + 0.06, fadeStart: Infinity, fadeEnd: Infinity, fadeLevel: 1 });
    return node;
  }

  close(time: number, release: number): void {
    this.lastClosed = time;
    for (const hat of this.hats) {
      if (hat.start > time + SAME_HIT_EPSILON || hat.end <= time || hat.fadeStart <= time) continue;
      this.fade(hat, time, Math.abs(hat.start - time) < SAME_HIT_EPSILON ? 0 : release);
    }
  }

  prune(now: number): void {
    this.hats = this.hats.filter((hat) => {
      if (hat.end > now) return true;
      hat.node.disconnect();
      return false;
    });
  }

  reset(now: number): void {
    for (const hat of this.hats) {
      if (hat.end <= now) hat.node.disconnect();
      else this.fade(hat, now, hat.start >= now ? 0 : 0.005);
    }
    // Native source stop times bound the remaining graphs after the short fade.
    // Teardown closes the context; no timer or callback retains these handles.
    this.hats = [];
    this.lastClosed = -Infinity;
  }

  private fade(hat: OpenHat, time: number, release: number): void {
    const level = time >= hat.fadeEnd ? 0 : time >= hat.fadeStart
      ? hat.fadeLevel * (hat.fadeEnd - time) / (hat.fadeEnd - hat.fadeStart) : 1;
    const duration = Math.max(0, Math.min(0.1, release));
    hat.node.gain.cancelScheduledValues(time);
    hat.node.gain.setValueAtTime(duration === 0 ? 0 : level, time);
    if (duration > 0) hat.node.gain.linearRampToValueAtTime(0, time + duration);
    hat.fadeStart = time;
    hat.fadeEnd = time + duration;
    hat.fadeLevel = level;
    hat.end = Math.min(hat.end, hat.fadeEnd);
  }
}
