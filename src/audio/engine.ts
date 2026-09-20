import { BLOCK_COUNT, type CustomVoiceSettings, type EffectiveBlock, type EngineSnapshot, type Machine, type Patch, type VoiceId } from "@/lib/types";
import { VOICE_DEFS } from "@/lib/constants";
import { clamp, effectiveBlock, euclidHit, lfoValue, volumeGain } from "@/lib/euclid";

interface QueuedVisualEvent {
  time: number;
  position: number;
  steps: number;
  pulses: number;
  rotation: number;
  division: number;
  lfo: number;
  fire: boolean;
}

interface RuntimeBlock {
  position: number;
  count: number;
  lfo: number;
  random: number;
  gateFrom: number;
  gateTo: number;
  lastClock: number | null;
  queue: QueuedVisualEvent[];
  displayPosition: number;
  displayLfo: number;
  fireUntil: number;
  displayPattern: { steps: number; pulses: number; rot: number; div: number };
}

type AudioContextConstructor = typeof AudioContext;

const LOOKAHEAD_SECONDS = 0.14;

export class SequencerEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private busses = new Map<VoiceId, GainNode>();
  private runtime: RuntimeBlock[] = [];
  private voiceHitAt = new Map<VoiceId, number>();
  private timer: number | null = null;
  private nextPulse = 0;
  private pulseIndex = 0;
  private pulsesIntoBar = 0;
  private clockQueue: Array<{ time: number; pulse: number }> = [];
  private displayClockPulse = -1;
  private _running = false;
  private barCallback: (() => void) | null = null;
  private getPatch: () => Patch;

  constructor(source: Patch | (() => Patch)) {
    this.getPatch = typeof source === "function" ? source : () => source;
    this.resetRuntime();
    VOICE_DEFS.forEach(({ id }) => this.voiceHitAt.set(id, -1));
  }

  get running() {
    return this._running;
  }

  async start(): Promise<void> {
    this.initAudio();
    if (!this.context) return;
    if (this.context.state === "suspended") await this.context.resume();
    this.resetRuntime();
    this.pulseIndex = 0;
    this.pulsesIntoBar = 0;
    this.nextPulse = this.context.currentTime + 0.08;
    this._running = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.scheduler(), 20);
    this.scheduler();
  }

  stop(): void {
    this._running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.resetRuntime();
  }

  reset(): void {
    this.resetRuntime();
    if (this._running && this.context) {
      this.pulseIndex = 0;
      this.pulsesIntoBar = 0;
      this.nextPulse = this.context.currentTime + 0.03;
    }
  }

  setVolume(value: number): void {
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(volumeGain(value), this.context.currentTime, 0.02);
    }
  }

  setPatch(patch: Patch): void {
    this.getPatch = () => patch;
  }

  setBarCallback(callback: (() => void) | null): void {
    this.barCallback = callback;
  }

  resetPattern(): void {
    this.resetRuntime();
  }

  destroy(): void {
    this.stop();
    void this.context?.close();
    this.context = null;
  }

  snapshot(): EngineSnapshot {
    const now = this.context?.currentTime ?? 0;
    const patch = this.getPatch();
    while (this.clockQueue.length && this.clockQueue[0].time <= now) {
      this.displayClockPulse = this.clockQueue.shift()!.pulse;
    }
    const blocks = this.runtime.map((runtime, index) => {
      while (runtime.queue.length && runtime.queue[0].time <= now) {
        const event = runtime.queue.shift()!;
        runtime.displayPosition = event.position;
        runtime.displayLfo = event.lfo;
        runtime.displayPattern = { steps: event.steps, pulses: event.pulses, rot: event.rotation, div: event.division };
        if (event.fire) runtime.fireUntil = now + 0.11;
      }
      const block = patch.blocks[index];
      return {
        position: runtime.displayPosition,
        lfo: runtime.displayLfo,
        fire: runtime.fireUntil > now,
        muted: block.mute || (block.mut !== "" && this.gateHigh(Number(block.mut), now)),
        effective: runtime.displayPattern,
      };
    });
    const activeVoices = Object.fromEntries(
      VOICE_DEFS.map(({ id }) => [id, (this.voiceHitAt.get(id) ?? -1) > 0 && now - (this.voiceHitAt.get(id) ?? -1) < 0.1]),
    );
    return { blocks, activeVoices, clockPulse: this.displayClockPulse };
  }

  private initAudio(): void {
    if (this.context) return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.12;
    this.master = this.context.createGain();
    this.master.gain.value = volumeGain(this.getPatch().vol);
    this.compressor.connect(this.master);
    this.master.connect(this.context.destination);

    const length = Math.floor(this.context.sampleRate * 2);
    this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    VOICE_DEFS.forEach(({ id }) => {
      const gain = this.context!.createGain();
      gain.connect(this.compressor!);
      this.busses.set(id, gain);
    });
  }

  private resetRuntime(): void {
    this.clockQueue = [];
    this.displayClockPulse = -1;
    const patch = this.getPatch?.();
    this.runtime = Array.from({ length: BLOCK_COUNT }, (_, index) => {
      const block = patch?.blocks[index];
      return {
        position: -1,
        count: 0,
        lfo: 0,
        random: Math.random(),
        gateFrom: -1,
        gateTo: -1,
        lastClock: null,
        queue: [],
        displayPosition: -1,
        displayLfo: 0,
        fireUntil: -1,
        displayPattern: { steps: block?.steps ?? 16, pulses: block?.pulses ?? 0, rot: block?.rot ?? 0, div: block?.div ?? 1 },
      };
    });
  }

  private pulseInterval(): number {
    const patch = this.getPatch();
    return 60 / patch.bpm / patch.rate;
  }

  private scheduler(): void {
    if (!this._running || !this.context) return;
    const now = this.context.currentTime;
    let guard = 0;
    while (this.nextPulse < now + LOOKAHEAD_SECONDS && guard++ < 64) {
      const patch = this.getPatch();
      const interval = this.pulseInterval();
      const swing = this.pulseIndex % 2 === 1 ? (patch.swing / 100) * interval * 0.5 : 0;
      this.tick(this.nextPulse + swing, this.pulseIndex);
      this.pulseIndex += 1;
      this.nextPulse += interval;
    }
  }

  private tick(time: number, pulseIndex: number): void {
    const patchBeforeBoundary = this.getPatch();
    if (this.pulsesIntoBar >= patchBeforeBoundary.rate * 4) {
      this.pulsesIntoBar = 0;
      this.barCallback?.();
    }
    this.clockQueue.push({ time, pulse: pulseIndex });
    const patch = this.getPatch();
    const queue: Array<{ source: string; time: number }> = [{ source: "G", time }];
    if (this.pulsesIntoBar === 0) queue.push({ source: "BAR", time });
    this.pulsesIntoBar += 1;
    const counts = new Array(BLOCK_COUNT).fill(0) as number[];
    let guard = 0;
    let head = 0;
    while (head < queue.length && guard++ < 400) {
      const event = queue[head++];
      patch.blocks.forEach((block, index) => {
        if (block.rst === event.source) this.resetBlock(index);
      });
      patch.blocks.forEach((block, index) => {
        if (!block.clk.includes(event.source as never) || counts[index]++ >= 8) return;
        if (this.advance(index, event.time)) queue.push({ source: String(index), time: event.time });
      });
    }
  }

  private effective(index: number): EffectiveBlock {
    const block = this.getPatch().blocks[index];
    const sourceLfo = block.modSrc === "" ? 0 : (this.runtime[Number(block.modSrc)]?.lfo ?? 0);
    return effectiveBlock(block, sourceLfo);
  }

  private advance(index: number, time: number): boolean {
    const patch = this.getPatch();
    const block = patch.blocks[index];
    const runtime = this.runtime[index];
    const interval = runtime.lastClock === null ? this.pulseInterval() : Math.max(0.008, time - runtime.lastClock);
    runtime.lastClock = time;
    runtime.count += 1;
    const effective = this.effective(index);
    if (runtime.count % effective.div !== 0) return false;
    runtime.position = (runtime.position + 1) % effective.steps;
    if (runtime.position === 0) runtime.random = Math.random();
    runtime.lfo = lfoValue(block.shape, runtime.position / effective.steps, runtime.random);
    const event: QueuedVisualEvent = {
      time,
      position: runtime.position,
      steps: effective.steps,
      pulses: effective.pulses,
      rotation: effective.rot,
      division: effective.div,
      lfo: runtime.lfo,
      fire: false,
    };
    if (
      !euclidHit(runtime.position, effective.steps, effective.pulses, effective.rot)
      || this.isMuted(index, time)
      || Math.random() * 100 >= effective.prob
    ) {
      runtime.queue.push(event);
      return false;
    }
    runtime.gateFrom = time;
    runtime.gateTo = time + Math.max(0.005, interval * block.gate / 100);
    event.fire = true;
    runtime.queue.push(event);
    if (block.voice) this.playVoice(block.voice, time, effective);
    return true;
  }

  private resetBlock(index: number): void {
    this.runtime[index].position = -1;
    this.runtime[index].count = 0;
  }

  private gateHigh(index: number, time: number): boolean {
    const runtime = this.runtime[index];
    return Boolean(runtime && runtime.gateFrom <= time && time < runtime.gateTo);
  }

  private isMuted(index: number, time: number): boolean {
    const block = this.getPatch().blocks[index];
    return block.mute || (block.mut !== "" && this.gateHigh(Number(block.mut), time));
  }

  private oscillator(type: OscillatorType, frequency: number, time: number): OscillatorNode {
    const oscillator = this.context!.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    return oscillator;
  }

  private gain(value: number, time: number): GainNode {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(value, time);
    return gain;
  }

  private decay(parameter: AudioParam, time: number, peak: number, duration: number): void {
    parameter.setValueAtTime(Math.max(0.0001, peak), time);
    parameter.exponentialRampToValueAtTime(0.0001, time + Math.max(0.01, duration));
  }

  private noiseSource(time: number, duration: number): AudioBufferSourceNode {
    const source = this.context!.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 1;
    source.start(time, Math.random() * 1.5, duration + 0.05);
    return source;
  }

  private filter(type: BiquadFilterType, frequency: number, q: number, time: number): BiquadFilterNode {
    const filter = this.context!.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.setValueAtTime(q, time);
    return filter;
  }

  private playVoice(id: VoiceId, time: number, modulation: EffectiveBlock): void {
    if (!this.context) return;
    const voice = this.getPatch().voices[id];
    if (!voice || voice.mute) return;
    const parameters = {
      machine: voice.machine,
      tune: clamp(voice.tune + modulation.tune * 12, -24, 24),
      decay: clamp(0.25 + (voice.decay + modulation.decay * 50) / 100 * 1.6, 0.15, 2.4),
      amplitude: clamp(voice.level / 100 * (1 + modulation.level * 0.6), 0, 1.4),
      custom: voice.custom,
    };
    if (parameters.amplitude <= 0.001) return;
    switch (id) {
      case "kick": this.kick(time, parameters); break;
      case "snare": this.snare(time, parameters); break;
      case "clap": this.clap(time, parameters); break;
      case "rim": this.rim(time, parameters); break;
      case "ch": this.hat(time, parameters, false); break;
      case "oh": this.hat(time, parameters, true); break;
      case "lt": case "mt": case "ht": this.tom(time, parameters, id); break;
      case "cow": this.cowbell(time, parameters); break;
      case "cym": this.cymbal(time, parameters); break;
      case "shk": this.shaker(time, parameters); break;
    }
    this.voiceHitAt.set(id, time);
  }

  private kick(time: number, p: SynthParameters): void {
    const bus = this.busses.get("kick")!;
    const custom = p.machine === "custom";
    const frequency = (custom ? value(p, "bodyFrequency", 50) : 50) * 2 ** (p.tune / 12);
    const duration = (custom ? value(p, "bodyDecay", 620) / 1000 : p.machine === "909" ? 0.42 : 0.85) * p.decay;
    const oscillator = this.oscillator("sine", frequency, time);
    oscillator.frequency.setValueAtTime(frequency * (custom ? value(p, "pitchAmount", 5.5) : p.machine === "909" ? 7 : 4.4), time);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, time + (custom ? value(p, "pitchDecay", 55) / 1000 : p.machine === "909" ? 0.035 : 0.07));
    const gain = this.gain(0, time);
    this.decay(gain.gain, time, p.amplitude, duration);
    oscillator.connect(gain).connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
    const clickDuration = custom ? value(p, "clickDecay", 16) / 1000 : 0.016;
    const click = this.noiseSource(time, clickDuration);
    const filter = this.filter("highpass", custom ? value(p, "clickFrequency", 1800) : 1400, 0.7, time);
    const clickGain = this.gain(0, time);
    this.decay(clickGain.gain, time, p.amplitude * (custom ? value(p, "clickLevel", 32) / 100 : p.machine === "909" ? 0.45 : 0.18), clickDuration);
    click.connect(filter).connect(clickGain).connect(bus);
  }

  private snare(time: number, p: SynthParameters): void {
    const bus = this.busses.get("snare")!;
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "noiseDecay", 260) / 1000 : p.machine === "909" ? 0.28 : 0.2) * p.decay;
    const noise = this.noiseSource(time, duration);
    const filter = this.filter(custom ? "bandpass" : p.machine === "909" ? "highpass" : "bandpass", custom ? value(p, "noiseFilter", 1800) : p.machine === "909" ? 900 : 2200, custom ? value(p, "noiseQ", 0.9) : 0.9, time);
    const noiseGain = this.gain(0, time);
    this.decay(noiseGain.gain, time, p.amplitude * (custom ? value(p, "noiseLevel", 80) / 100 : 0.8), duration);
    noise.connect(filter).connect(noiseGain).connect(bus);
    const base = (custom ? value(p, "toneFrequency", 185) : 185) * 2 ** (p.tune / 12);
    [1, custom ? value(p, "toneSpread", 1.62) : 1.62].forEach((ratio, index) => {
      const oscillator = this.oscillator("triangle", base * ratio, time);
      const gain = this.gain(0, time);
      const toneLevel = custom ? value(p, "toneLevel", 42) / 100 : 0.42;
      this.decay(gain.gain, time, p.amplitude * toneLevel * (index ? 0.67 : 1), 0.13 * p.decay);
      oscillator.connect(gain).connect(bus);
      oscillator.start(time);
      oscillator.stop(time + 0.2 * p.decay + 0.03);
    });
  }

  private clap(time: number, p: SynthParameters): void {
    const bus = this.busses.get("clap")!;
    const custom = p.machine === "custom";
    const filter = this.filter("bandpass", (custom ? value(p, "filterFrequency", 1080) : 1080) * 2 ** (p.tune / 24), custom ? value(p, "filterQ", 1.1) : 1.1, time);
    filter.connect(bus);
    const spread = custom ? value(p, "burstSpacing", 11) / 1000 : p.machine === "909" ? 0.009 : 0.013;
    const burstCount = custom ? Math.round(value(p, "burstCount", 3)) : 3;
    for (let index = 0; index < burstCount; index += 1) {
      const start = time + index * spread;
      const gain = this.gain(0, start);
      this.decay(gain.gain, start, p.amplitude * (custom ? value(p, "burstLevel", 55) / 100 : 0.55), 0.018);
      this.noiseSource(start, 0.03).connect(gain).connect(filter);
    }
    const tailGain = this.gain(0, time);
    const tailStart = time + spread * Math.max(0, burstCount - 1);
    const tailDuration = (custom ? value(p, "tailDecay", 220) / 1000 : 0.22) * p.decay;
    this.decay(tailGain.gain, tailStart, p.amplitude * (custom ? value(p, "tailLevel", 50) / 100 : 0.5), tailDuration);
    this.noiseSource(tailStart, tailDuration).connect(tailGain).connect(filter);
  }

  private rim(time: number, p: SynthParameters): void {
    const bus = this.busses.get("rim")!;
    const custom = p.machine === "custom";
    const filter = this.filter("bandpass", (custom ? value(p, "filterFrequency", 1750) : 1750) * 2 ** (p.tune / 12), custom ? value(p, "filterQ", 3.5) : 3.5, time);
    const gain = this.gain(0, time);
    const duration = (custom ? value(p, "duration", 35) / 1000 : 0.035) * p.decay;
    this.decay(gain.gain, time, p.amplitude * (custom ? value(p, "toneLevel", 70) / 100 : 0.7), duration);
    [custom ? value(p, "lowFrequency", 1670) : 1670, custom ? value(p, "highFrequency", 2350) : 2350].forEach((frequency) => {
      const oscillator = this.oscillator("square", frequency * 2 ** (p.tune / 12), time);
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.015);
    });
    const noiseGain = this.gain(0, time);
    this.decay(noiseGain.gain, time, p.amplitude * (custom ? value(p, "noiseLevel", 25) / 100 : 0.25), Math.min(0.02, duration));
    this.noiseSource(time, 0.02).connect(noiseGain).connect(filter);
    filter.connect(gain).connect(bus);
  }

  private metallic(time: number, duration: number, tune: number, amplitude: number, destination: AudioNode, highpass: number, baseFrequency = 40): void {
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const base = baseFrequency * 2 ** (tune / 12);
    const hp = this.filter("highpass", highpass, 0.8, time);
    const bp = this.filter("bandpass", 9000, 0.9, time);
    const gain = this.gain(0, time);
    this.decay(gain.gain, time, amplitude, duration);
    ratios.forEach((ratio) => {
      const oscillator = this.oscillator("square", base * ratio, time);
      oscillator.connect(hp);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
    });
    hp.connect(bp).connect(gain).connect(destination);
  }

  private hat(time: number, p: SynthParameters, open: boolean): void {
    const bus = this.busses.get(open ? "oh" : "ch")!;
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "duration", open ? 420 : 58) / 1000 : open ? 0.42 : 0.058) * p.decay;
    if (custom) {
      const noiseFilter = this.filter("highpass", value(p, "noiseHighpass", 7800) * 2 ** (p.tune / 24), 0.8, time);
      const noiseGain = this.gain(0, time);
      this.decay(noiseGain.gain, time, p.amplitude * value(p, "noiseLevel", 20) / 100, duration);
      this.noiseSource(time, duration).connect(noiseFilter).connect(noiseGain).connect(bus);
      this.metallic(time, duration, p.tune, p.amplitude * value(p, "metalLevel", 50) / 100, bus, value(p, "highpass", 7400), value(p, "metalBase", 40));
    } else if (p.machine === "909") {
      const filter = this.filter("highpass", 7800 * 2 ** (p.tune / 24), 0.8, time);
      const gain = this.gain(0, time);
      this.decay(gain.gain, time, p.amplitude * 0.55, duration);
      this.noiseSource(time, duration).connect(filter).connect(gain).connect(bus);
      this.metallic(time, duration * 0.7, p.tune, p.amplitude * 0.2, bus, 7000);
    } else {
      this.metallic(time, duration, p.tune, p.amplitude * 0.5, bus, 7400);
    }
  }

  private tom(time: number, p: SynthParameters, id: "lt" | "mt" | "ht"): void {
    const bus = this.busses.get(id)!;
    const custom = p.machine === "custom";
    const base = (custom ? value(p, "bodyFrequency", ({ lt: 92, mt: 138, ht: 196 })[id]) : ({ lt: 92, mt: 138, ht: 196 })[id]) * 2 ** (p.tune / 12);
    const duration = (custom ? value(p, "duration", 450) / 1000 : p.machine === "909" ? 0.3 : 0.45) * p.decay;
    const oscillator = this.oscillator("sine", base, time);
    oscillator.frequency.setValueAtTime(base * (custom ? value(p, "pitchAmount", 1.7) : 1.7), time);
    oscillator.frequency.exponentialRampToValueAtTime(base, time + (custom ? value(p, "pitchDecay", 70) / 1000 : 0.07));
    const gain = this.gain(0, time);
    this.decay(gain.gain, time, p.amplitude * (custom ? value(p, "bodyLevel", 90) / 100 : 0.9), duration);
    oscillator.connect(gain).connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
    const filter = this.filter("bandpass", custom ? value(p, "noiseFilter", base * 4) : base * 4, 1.2, time);
    const noiseGain = this.gain(0, time);
    this.decay(noiseGain.gain, time, p.amplitude * (custom ? value(p, "noiseLevel", 18) / 100 : 0.18), 0.05);
    this.noiseSource(time, 0.04).connect(filter).connect(noiseGain).connect(bus);
  }

  private cowbell(time: number, p: SynthParameters): void {
    const bus = this.busses.get("cow")!;
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "duration", 360) / 1000 : 0.36) * p.decay;
    const filter = this.filter("bandpass", custom ? value(p, "filterFrequency", 2640) : 2640, custom ? value(p, "filterQ", 1.4) : 1.4, time);
    const gain = this.gain(0.0001, time);
    gain.gain.linearRampToValueAtTime(p.amplitude * (custom ? value(p, "toneLevel", 55) / 100 : 0.55), time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    [custom ? value(p, "lowFrequency", 540) : 540, custom ? value(p, "highFrequency", 800) : 800].forEach((frequency) => {
      const oscillator = this.oscillator("square", frequency * 2 ** (p.tune / 12), time);
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
    });
    filter.connect(gain).connect(bus);
  }

  private cymbal(time: number, p: SynthParameters): void {
    const bus = this.busses.get("cym")!;
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "duration", 1400) / 1000 : p.machine === "909" ? 1.6 : 1.15) * p.decay;
    this.metallic(time, duration, p.tune - 2, p.amplitude * (custom ? value(p, "metalLevel", 40) / 100 : 0.4), bus, custom ? value(p, "highpass", 4200) : 4200, custom ? value(p, "metalBase", 40) : 40);
    const filter = this.filter("highpass", custom ? value(p, "noiseHighpass", 5200) : 5200, 0.7, time);
    const gain = this.gain(0, time);
    this.decay(gain.gain, time, p.amplitude * (custom ? value(p, "noiseLevel", 32) / 100 : p.machine === "909" ? 0.4 : 0.22), duration);
    this.noiseSource(time, duration).connect(filter).connect(gain).connect(bus);
  }

  private shaker(time: number, p: SynthParameters): void {
    const bus = this.busses.get("shk")!;
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "duration", 75) / 1000 : 0.075) * p.decay;
    const filter = this.filter("bandpass", (custom ? value(p, "filterFrequency", 6200) : 6200) * 2 ** (p.tune / 24), custom ? value(p, "filterQ", 1.6) : 1.6, time);
    const gain = this.gain(0.0001, time);
    gain.gain.linearRampToValueAtTime(p.amplitude * (custom ? value(p, "noiseLevel", 50) / 100 : 0.5), time + (custom ? value(p, "attack", 6) / 1000 : 0.006));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    this.noiseSource(time, duration).connect(filter).connect(gain).connect(bus);
  }
}

interface SynthParameters {
  machine: Machine;
  tune: number;
  decay: number;
  amplitude: number;
  custom: CustomVoiceSettings;
}

const value = (parameters: SynthParameters, key: string, fallback: number) => parameters.custom[key] ?? fallback;
