import { BLOCK_COUNT, type CustomVoiceSettings, type EffectId, type EffectsState, type EffectiveBlock, type EngineSnapshot, type Machine, type Patch, type VoiceId } from "@/lib/types";
import { VOICE_DEFS } from "@/lib/constants";
import { clamp, effectiveBlock, euclidHit, volumeGain } from "@/lib/euclid";
import { effectiveVoiceModulation } from "@/lib/modulation";
import { quantizeVoiceCv } from "@/lib/quantizer";
import { synthFilterSweep } from "@/lib/synth-filter";
import { pulseWaveCoefficients } from "@/lib/pulse-wave";
import { shakerTextureCurve } from "@/lib/shaker-texture";
import { sampleLfo, type LfoFrame } from "@/lib/lfo";
import { EFFECT_IDS, effectGain, waveguideDamping, waveguideFeedback, waveguideFrequency, delaySeconds, distortionSample, REVERB_SECONDS } from "@/lib/effects";
import { rhythmAt, rhythmsFor } from "@/lib/rhythm-series";
import { HatChoke } from "./hat-choke";
import { SynthArticulation, type SynthNote } from "./synth-articulation";

interface QueuedVisualEvent {
  time: number;
  position: number;
  rhythmIndex: number;
  effective: EffectiveBlock;
  wave: LfoFrame | null;
  fire: boolean;
}

interface RuntimeBlock {
  position: number;
  rhythmIndex: number;
  rhythmRepeat: number;
  count: number;
  wave: LfoFrame | null;
  random: number;
  gateFrom: number;
  gateTo: number;
  lastClock: number | null;
  queue: QueuedVisualEvent[];
  displayPosition: number;
  displayRhythmIndex: number;
  displayWave: LfoFrame | null;
  fireUntil: number;
  displayPattern: EffectiveBlock;
}

type AudioContextConstructor = typeof AudioContext;

const LOOKAHEAD_SECONDS = 0.14;
// Web Audio low/highpass Q is in dB, not a linear quality factor.
// https://www.w3.org/TR/webaudio/#dom-biquadfilternode-q
const BUTTERWORTH_Q_DB = 20 * Math.log10(Math.SQRT1_2);

export interface OutputAnalysis {
  sampleRate: number;
  binCount: number;
  read: (data: Uint8Array<ArrayBuffer>) => void;
  disconnect: () => void;
}

export class SequencerEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private outputAnalysers = new Set<AnalyserNode>();
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private busses = new Map<VoiceId, GainNode>();
  private sendGains = new Map<string, GainNode>();
  private effectReturns = new Map<EffectId, GainNode>();
  private distortion: WaveShaperNode | null = null;
  private distortionTone: BiquadFilterNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbDamping: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private delayTone: BiquadFilterNode | null = null;
  private delayFeedback: GainNode | null = null;
  private parallelCompressor: DynamicsCompressorNode | null = null;
  private karplusDelay: DelayNode | null = null;
  private karplusDamping: BiquadFilterNode | null = null;
  private karplusFeedback: GainNode | null = null;
  private distortionShape = "";
  private distortionTrim: GainNode | null = null;
  private reverbPreDelay: DelayNode | null = null;
  private reverbLowCut: BiquadFilterNode | null = null;
  private delayLowCut: BiquadFilterNode | null = null;
  private karplusExcitation: BiquadFilterNode | null = null;
  private compressorMakeup: GainNode | null = null;
  private reverbImpulses = new Map<string, AudioBuffer>();
  private reverbSpace = "";
  private appliedBpm = -1;
  private parameterTargets = new WeakMap<AudioParam, number>();
  private appliedEffects: EffectsState | null = null;
  private runtime: RuntimeBlock[] = [];
  private voiceHitAt = new Map<VoiceId, number>();
  private hatChoke = new HatChoke();
  private synthArticulation = { bassline: new SynthArticulation(), lead: new SynthArticulation() };
  private pulseWaves = new Map<number, PeriodicWave>();
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
    this.outputAnalysers.forEach((analyser) => this.disconnectOutputAnalyser(analyser));
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

  // A lazy, silent side branch leaves the audible master path untouched.
  observeOutput = (): OutputAnalysis | null => {
    if (!this._running || !this.context || !this.master) return null;
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    analyser.minDecibels = -80;
    analyser.maxDecibels = -12;
    this.master.connect(analyser);
    this.outputAnalysers.add(analyser);
    return {
      sampleRate: this.context.sampleRate,
      binCount: analyser.frequencyBinCount,
      read: (data) => analyser.getByteFrequencyData(data),
      disconnect: () => this.disconnectOutputAnalyser(analyser),
    };
  };

  private disconnectOutputAnalyser(analyser: AnalyserNode): void {
    if (!this.outputAnalysers.delete(analyser)) return;
    this.master?.disconnect(analyser);
    analyser.disconnect();
  }

  setPatch(patch: Patch): void {
    this.getPatch = () => patch;
    this.applyEffects();
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
    this.reverbImpulses.clear();
    this.pulseWaves.clear();
    this.appliedEffects = null;
    this.distortionShape = "";
    this.reverbSpace = "";
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
        runtime.displayRhythmIndex = event.rhythmIndex;
        runtime.displayWave = event.wave;
        runtime.displayPattern = event.effective;
        if (event.fire) runtime.fireUntil = now + 0.11;
      }
      const block = patch.blocks[index];
      const displayRhythmIndex = Math.min(runtime.displayRhythmIndex, rhythmsFor(block).length - 1);
      const lfo = runtime.displayWave ? sampleLfo(runtime.displayWave, now) : { value: block.kind === "voice" && block.voice ? 0 : 0.5, position: -1 };
      return {
        position: runtime.displayPosition,
        rhythmIndex: displayRhythmIndex,
        lfo: lfo.value,
        lfoPosition: lfo.position,
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
    this.initEffects();
    this.applyEffects();
  }

  private initEffects(): void {
    if (!this.context || !this.compressor) return;
    const createReturn = (id: EffectId) => {
      const gain = this.context!.createGain();
      gain.gain.value = 0;
      gain.connect(this.compressor!);
      this.effectReturns.set(id, gain);
      return gain;
    };

    const distortionInput = this.context.createGain();
    this.distortion = this.context.createWaveShaper();
    this.distortion.oversample = "2x";
    this.distortionTone = this.context.createBiquadFilter();
    this.distortionTone.type = "lowpass";
    this.distortionTrim = this.context.createGain();
    distortionInput.connect(this.distortion).connect(this.distortionTone).connect(this.distortionTrim).connect(createReturn("distortion"));

    const reverbInput = this.context.createGain();
    this.reverb = this.context.createConvolver();
    // Three bounded impulses are prepared once, outside the scheduler. Space changes only swap buffers.
    for (const [space, seconds] of Object.entries(REVERB_SECONDS)) this.reverbImpulses.set(space, this.createReverbImpulse(seconds));
    this.reverbPreDelay = this.context.createDelay(0.2);
    this.reverbLowCut = this.context.createBiquadFilter();
    this.reverbLowCut.type = "highpass";
    this.reverbLowCut.Q.value = BUTTERWORTH_Q_DB;
    this.reverbDamping = this.context.createBiquadFilter();
    this.reverbDamping.type = "lowpass";
    reverbInput.connect(this.reverbPreDelay).connect(this.reverbLowCut).connect(this.reverb).connect(this.reverbDamping).connect(createReturn("reverb"));

    const delayInput = this.context.createGain();
    this.delay = this.context.createDelay(6);
    this.delayLowCut = this.context.createBiquadFilter();
    this.delayLowCut.type = "highpass";
    this.delayLowCut.Q.value = BUTTERWORTH_Q_DB;
    this.delayTone = this.context.createBiquadFilter();
    this.delayTone.type = "lowpass";
    this.delayTone.Q.value = BUTTERWORTH_Q_DB;
    this.delayFeedback = this.context.createGain();
    delayInput.connect(this.delay).connect(this.delayLowCut).connect(this.delayTone).connect(createReturn("delay"));
    this.delayTone.connect(this.delayFeedback).connect(this.delay);

    const compressorInput = this.context.createGain();
    this.parallelCompressor = this.context.createDynamicsCompressor();
    this.compressorMakeup = this.context.createGain();
    compressorInput.connect(this.parallelCompressor).connect(this.compressorMakeup).connect(createReturn("compressor"));

    const karplusInput = this.context.createGain();
    this.karplusExcitation = this.context.createBiquadFilter();
    this.karplusExcitation.type = "lowpass";
    this.karplusExcitation.Q.value = BUTTERWORTH_Q_DB;
    this.karplusDelay = this.context.createDelay(1);
    this.karplusDamping = this.context.createBiquadFilter();
    this.karplusDamping.type = "lowpass";
    // No resonant boost inside a near-unity feedback loop.
    this.karplusDamping.Q.value = BUTTERWORTH_Q_DB;
    this.karplusFeedback = this.context.createGain();
    karplusInput.connect(this.karplusExcitation).connect(this.karplusDelay).connect(this.karplusDamping).connect(createReturn("karplus"));
    this.karplusDamping.connect(this.karplusFeedback).connect(this.karplusDelay);

    const inputs: Record<EffectId, GainNode> = {
      distortion: distortionInput,
      reverb: reverbInput,
      delay: delayInput,
      karplus: karplusInput,
      compressor: compressorInput,
    };
    for (const { id } of VOICE_DEFS) {
      const bus = this.busses.get(id)!;
      for (const effect of EFFECT_IDS) {
        const send = this.context.createGain();
        send.gain.value = 0;
        bus.connect(send).connect(inputs[effect]);
        this.sendGains.set(`${id}:${effect}`, send);
      }
    }
  }

  private createReverbImpulse(duration: number): AudioBuffer {
    const length = Math.floor(this.context!.sampleRate * duration);
    const impulse = this.context!.createBuffer(2, length, this.context!.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const envelope = (1 - index / length) ** 2.6;
        data[index] = (Math.random() * 2 - 1) * envelope;
      }
    }
    return impulse;
  }

  private applyEffects(): void {
    if (!this.context) return;
    const { effects, bpm } = this.getPatch();
    if (effects === this.appliedEffects && bpm === this.appliedBpm) return;
    this.appliedBpm = bpm;
    this.appliedEffects = effects;
    const now = this.context.currentTime;
    const smooth = (parameter: AudioParam | undefined, next: number, timeConstant = 0.015) => {
      if (!parameter || this.parameterTargets.get(parameter) === next) return;
      this.parameterTargets.set(parameter, next);
      parameter.setTargetAtTime(next, now, timeConstant);
    };
    for (const { id } of VOICE_DEFS) {
      for (const effect of EFFECT_IDS) {
        const send = this.sendGains.get(`${id}:${effect}`);
        smooth(send?.gain, effects[effect].enabled ? effectGain(effects.sends[id][effect]) : 0);
      }
    }
    for (const effect of EFFECT_IDS) {
      smooth(this.effectReturns.get(effect)?.gain, effects[effect].enabled ? effectGain(effects[effect].return) : 0);
    }

    const shape = `${effects.distortion.mode}:${effects.distortion.drive}`;
    if (this.distortion && shape !== this.distortionShape) {
      this.distortionShape = shape;
      const curve = new Float32Array(2049);
      for (let index = 0; index < curve.length; index += 1) {
        curve[index] = distortionSample(index * 2 / (curve.length - 1) - 1, effects.distortion);
      }
      this.distortion.curve = curve;
    }
    if (this.reverb && effects.reverb.space !== this.reverbSpace) {
      this.reverbSpace = effects.reverb.space;
      this.reverb.buffer = this.reverbImpulses.get(this.reverbSpace)!;
    }
    smooth(this.distortionTrim?.gain, 10 ** (effects.distortion.trim / 20));
    smooth(this.reverbPreDelay?.delayTime, effects.reverb.preDelay / 1000);
    smooth(this.reverbLowCut?.frequency, effects.reverb.lowCut);
    smooth(this.delayLowCut?.frequency, effects.delay.lowCut);
    smooth(this.karplusExcitation?.frequency, effects.karplus.excitation === 16000 ? this.context.sampleRate / 2 : effects.karplus.excitation);
    smooth(this.compressorMakeup?.gain, 10 ** (effects.compressor.makeup / 20));
    smooth(this.parallelCompressor?.knee, effects.compressor.knee);
    smooth(this.distortionTone?.frequency, effects.distortion.tone);
    smooth(this.reverbDamping?.frequency, effects.reverb.damping);
    smooth(this.delay?.delayTime, delaySeconds(effects.delay, bpm));
    smooth(this.delayFeedback?.gain, effects.delay.feedback / 100);
    smooth(this.delayTone?.frequency, effects.delay.tone);
    const waveguideHz = waveguideFrequency(effects.karplus.tune) * 2 ** effects.karplus.octave;
    const waveguideDelay = effects.karplus.model === "tube" ? 1 / (waveguideHz * 2) : 1 / waveguideHz;
    smooth(this.karplusDelay?.delayTime, waveguideDelay);
    smooth(this.karplusDamping?.frequency, waveguideDamping(effects.karplus.body));
    smooth(this.karplusFeedback?.gain, waveguideFeedback(effects.karplus.decay) * (effects.karplus.model === "tube" ? -1 : 1));
    smooth(this.parallelCompressor?.threshold, effects.compressor.threshold);
    smooth(this.parallelCompressor?.ratio, effects.compressor.ratio);
    smooth(this.parallelCompressor?.attack, effects.compressor.attack / 1000);
    smooth(this.parallelCompressor?.release, effects.compressor.release / 1000);
  }

  private resetRuntime(): void {
    this.hatChoke.reset(this.context?.currentTime ?? 0);
    this.synthArticulation.bassline.reset(this.context?.currentTime ?? 0);
    this.synthArticulation.lead.reset(this.context?.currentTime ?? 0);
    this.clockQueue = [];
    this.displayClockPulse = -1;
    const patch = this.getPatch?.();
    this.runtime = Array.from({ length: BLOCK_COUNT }, (_, index) => {
      const block = patch?.blocks[index];
      return {
        position: -1,
        rhythmIndex: 0,
        rhythmRepeat: 0,
        count: 0,
        wave: null,
        random: Math.random(),
        gateFrom: -1,
        gateTo: -1,
        lastClock: null,
        queue: [],
        displayPosition: -1,
        displayRhythmIndex: 0,
        displayWave: null,
        fireUntil: -1,
        displayPattern: { steps: block?.steps ?? 16, pulses: block?.pulses ?? 0, rot: block?.rot ?? 0, div: block?.div ?? 1, prob: block?.prob ?? 100, tune: 0, decay: 0, level: 0 },
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
    this.hatChoke.prune(now);
    this.synthArticulation.bassline.prune(now);
    this.synthArticulation.lead.prune(now);
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
        if (block.rst === event.source) this.resetBlock(index, event.time);
      });
      patch.blocks.forEach((block, index) => {
        if (!block.clk.includes(event.source as never) || counts[index]++ >= 8) return;
        if (this.advance(index, event.time)) queue.push({ source: String(index), time: event.time });
      });
    }
  }

  private effective(index: number, time: number, rhythmIndex = this.runtime[index].rhythmIndex): EffectiveBlock {
    const block = this.getPatch().blocks[index];
    return effectiveBlock(block, (source) => this.sourceLfo(source, time), rhythmIndex);
  }

  private sourceLfo(source: number, time: number): number {
    const wave = this.runtime[source]?.wave;
    const sourceBlock = this.getPatch().blocks[source];
    return wave ? sampleLfo(wave, time).value : sourceBlock?.kind === "voice" && sourceBlock.voice ? 0 : 0.5;
  }

  private advance(index: number, time: number): boolean {
    const patch = this.getPatch();
    const block = patch.blocks[index];
    const runtime = this.runtime[index];
    const rhythms = rhythmsFor(block);
    if (runtime.rhythmIndex >= rhythms.length) {
      runtime.rhythmIndex = 0;
      runtime.rhythmRepeat = 0;
      runtime.position = -1;
    }
    const interval = runtime.lastClock === null ? this.pulseInterval() : Math.max(0.008, time - runtime.lastClock);
    runtime.lastClock = time;
    runtime.count += 1;
    let effective = this.effective(index, time);
    if (runtime.count % effective.div !== 0) return false;
    if (runtime.position >= effective.steps - 1) {
      runtime.rhythmRepeat += 1;
      const rhythm = rhythmAt(block, runtime.rhythmIndex);
      if (runtime.rhythmRepeat >= rhythm.repeats) {
        runtime.rhythmRepeat = 0;
        runtime.rhythmIndex = (runtime.rhythmIndex + 1) % rhythms.length;
      }
      effective = this.effective(index, time);
      runtime.position = 0;
    } else {
      runtime.position += 1;
    }
    const hit = euclidHit(runtime.position, effective.steps, effective.pulses, effective.rot);
    const euclideanLfo = block.kind !== "voice" || !block.voice;
    if (euclideanLfo ? hit : runtime.position === 0) runtime.random = Math.random();
    runtime.wave = {
      time, position: runtime.position, stepDuration: interval * effective.div,
      rhythm: effective, shape: block.shape, random: runtime.random, euclidean: euclideanLfo,
    };
    const event: QueuedVisualEvent = {
      time,
      position: runtime.position,
      rhythmIndex: runtime.rhythmIndex,
      effective,
      wave: runtime.wave,
      fire: false,
    };
    if (!hit || this.isMuted(index, time) || (block.kind !== "bernoulli" && Math.random() * 100 >= effective.prob)) {
      runtime.queue.push(event);
      return false;
    }
    runtime.gateFrom = time;
    runtime.gateTo = time + Math.max(0.005, interval * block.gate / 100);
    event.fire = true;
    runtime.queue.push(event);
    if (block.kind === "voice" && block.voice) this.playVoice(block.voice, time, effective);
    if (block.kind === "bernoulli") this.playVoice(block.branchVoices[Math.random() * 100 < effective.prob ? 0 : 1], time, effective);
    return true;
  }

  private resetBlock(index: number, time: number): void {
    const runtime = this.runtime[index];
    runtime.position = -1;
    runtime.rhythmIndex = 0;
    runtime.rhythmRepeat = 0;
    runtime.count = 0;
    runtime.wave = null;
    runtime.lastClock = null;
    runtime.queue.push({ time, position: -1, rhythmIndex: 0, wave: null, fire: false, effective: effectiveBlock({ ...this.getPatch().blocks[index], modulations: [] }) });
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
    oscillator.frequency.setValueAtTime(this.safeFrequency(frequency), time);
    return oscillator;
  }

  private gain(value: number, time: number): GainNode {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(value, time);
    return gain;
  }

  private decay(parameter: AudioParam, time: number, peak: number, duration: number): void {
    if (peak <= 0) {
      parameter.setValueAtTime(0, time);
      return;
    }
    parameter.setValueAtTime(Math.max(0.0001, peak), time);
    parameter.exponentialRampToValueAtTime(0.0001, time + Math.max(0.01, duration));
    parameter.linearRampToValueAtTime(0, time + Math.max(0.01, duration) + 0.005);
  }

  private noiseSource(time: number, duration: number, offset?: number): AudioBufferSourceNode {
    const source = this.context!.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 1;
    // A random offset must not shorten long hats/cymbals to the buffer remainder.
    source.loop = true;
    source.start(time, offset ?? Math.random() * this.noise!.duration);
    source.stop(time + duration + 0.05);
    return source;
  }

  private safeFrequency(frequency: number): number {
    return clamp(frequency, 1, this.context!.sampleRate * 0.49);
  }

  private brightnessDestination(time: number, p: SynthParameters, bus: AudioNode): AudioNode {
    const cutoff = value(p, "lowpass", 20000);
    if (p.machine !== "custom" || cutoff >= 20000) return bus;
    const filter = this.filter("lowpass", cutoff, BUTTERWORTH_Q_DB, time);
    filter.connect(bus);
    return filter;
  }

  private attackDecay(parameter: AudioParam, time: number, peak: number, attack: number, duration: number): void {
    parameter.setValueAtTime(0, time);
    if (peak <= 0) return;
    const end = Math.max(duration, attack + 0.005);
    parameter.linearRampToValueAtTime(peak, time + attack);
    parameter.exponentialRampToValueAtTime(0.0001, time + end);
    parameter.linearRampToValueAtTime(0, time + end + 0.005);
  }

  private filter(type: BiquadFilterType, frequency: number, q: number, time: number): BiquadFilterNode {
    const filter = this.context!.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(this.safeFrequency(frequency), time);
    filter.Q.setValueAtTime(q, time);
    return filter;
  }

  private playVoice(id: VoiceId, time: number, modulation: EffectiveBlock): void {
    if (!this.context) return;
    const voice = this.getPatch().voices[id];
    if (!voice || voice.mute) return;
    const routed = effectiveVoiceModulation(voice, (source) => this.sourceLfo(source, time));
    const tune = clamp(voice.tune + (modulation.tune + routed.tune) * 12, -24, 24);
    const parameters = {
      machine: voice.machine,
      tune,
      decay: clamp(0.25 + (voice.decay + (modulation.decay + routed.decay) * 50) / 100 * 1.6, 0.15, 2.4),
      amplitude: clamp(voice.level / 100 * (1 + (modulation.level + routed.level) * 0.6), 0, 1.4),
      levelModulation: modulation.level + routed.level,
      custom: voice.custom,
      frequency: quantizeVoiceCv(voice.custom, routed.vOct, tune).frequency,
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
      case "bassline": this.bassline(time, parameters); break;
      case "lead": this.lead(time, parameters); break;
    }
    this.voiceHitAt.set(id, time);
  }

  private kick(time: number, p: SynthParameters): void {
    const bus = this.busses.get("kick")!;
    const custom = p.machine === "custom";
    const frequency = (custom ? value(p, "bodyFrequency", 50) : 50) * 2 ** (p.tune / 12);
    const duration = (custom ? value(p, "bodyDecay", 620) / 1000 : p.machine === "909" ? 0.42 : 0.85) * p.decay;
    const gain = this.gain(0, time);
    this.decay(gain.gain, time, p.amplitude, duration);
    gain.connect(bus);
    const harmonics = custom ? value(p, "bodyTone", 0) / 100 : 0;
    const shapes: Array<[OscillatorType, number]> = [["sine", 1 - harmonics], ["triangle", harmonics]];
    for (const [shape, level] of shapes) {
      if (level === 0) continue;
      const oscillator = this.oscillator(shape, frequency, time);
      oscillator.frequency.setValueAtTime(this.safeFrequency(frequency * (custom ? value(p, "pitchAmount", 5.5) : p.machine === "909" ? 7 : 4.4)), time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, time + (custom ? value(p, "pitchDecay", 55) / 1000 : p.machine === "909" ? 0.035 : 0.07));
      oscillator.connect(this.gain(level, time)).connect(gain);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.05);
    }
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
    const attack = custom ? value(p, "noiseAttack", 0) / 1000 : 0;
    const noiseDuration = (custom ? value(p, "noiseDecay", 260) / 1000 : p.machine === "909" ? 0.28 : 0.2) * p.decay;
    const duration = attack > 0 ? Math.max(attack + 0.005, noiseDuration) : noiseDuration;
    const noise = this.noiseSource(time, duration);
    const filter = this.filter(custom ? "bandpass" : p.machine === "909" ? "highpass" : "bandpass", custom ? value(p, "noiseFilter", 1800) : p.machine === "909" ? 900 : 2200, custom ? value(p, "noiseQ", 0.9) : 0.9, time);
    const noiseGain = this.gain(0, time);
    const noiseLevel = p.amplitude * (custom ? value(p, "noiseLevel", 80) / 100 : 0.8);
    if (attack > 0) this.attackDecay(noiseGain.gain, time, noiseLevel, attack, duration);
    else this.decay(noiseGain.gain, time, noiseLevel, duration);
    noise.connect(filter).connect(noiseGain).connect(bus);
    const base = (custom ? value(p, "toneFrequency", 185) : 185) * 2 ** (p.tune / 12);
    [1, custom ? value(p, "toneSpread", 1.62) : 1.62].forEach((ratio, index) => {
      const oscillator = this.oscillator("triangle", base * ratio, time);
      const pitchAmount = custom ? value(p, "pitchAmount", 1) : 1;
      if (pitchAmount > 1) {
        oscillator.frequency.setValueAtTime(this.safeFrequency(base * ratio * pitchAmount), time);
        oscillator.frequency.exponentialRampToValueAtTime(this.safeFrequency(base * ratio), time + value(p, "pitchDecay", 30) / 1000);
      }
      const gain = this.gain(0, time);
      const toneLevel = custom ? value(p, "toneLevel", 42) / 100 : 0.42;
      const toneDuration = (custom ? value(p, "toneDecay", 130) / 1000 : 0.13) * p.decay;
      this.decay(gain.gain, time, p.amplitude * toneLevel * (index ? 0.67 : 1), toneDuration);
      oscillator.connect(gain).connect(bus);
      oscillator.start(time);
      oscillator.stop(time + toneDuration + 0.03);
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
      const burstDuration = custom ? value(p, "burstDecay", 18) / 1000 : 0.018;
      this.decay(gain.gain, start, p.amplitude * (custom ? value(p, "burstLevel", 55) / 100 : 0.55), burstDuration);
      this.noiseSource(start, burstDuration).connect(gain).connect(filter);
    }
    const tailGain = this.gain(0, time);
    const tailStart = time + spread * Math.max(0, burstCount - 1);
    const attack = custom ? value(p, "tailAttack", 0) / 1000 : 0;
    const requestedDuration = (custom ? value(p, "tailDecay", 220) / 1000 : 0.22) * p.decay;
    const tailDuration = attack > 0 ? Math.max(attack + 0.005, requestedDuration) : requestedDuration;
    const tailLevel = p.amplitude * (custom ? value(p, "tailLevel", 50) / 100 : 0.5);
    if (attack > 0) this.attackDecay(tailGain.gain, tailStart, tailLevel, attack, tailDuration);
    else this.decay(tailGain.gain, tailStart, tailLevel, tailDuration);
    const tailFrequency = custom ? value(p, "tailFilter", 0) : 0;
    const tailFilter = tailFrequency > 0 && tailLevel > 0
      ? this.filter("bandpass", tailFrequency * 2 ** (p.tune / 24), value(p, "filterQ", 1.1), tailStart)
      : filter;
    if (tailFilter !== filter) tailFilter.connect(bus);
    this.noiseSource(tailStart, tailDuration).connect(tailGain).connect(tailFilter);
  }

  private rim(time: number, p: SynthParameters): void {
    const bus = this.busses.get("rim")!;
    const custom = p.machine === "custom";
    const filterFrequency = (custom ? value(p, "filterFrequency", 1750) : 1750) * 2 ** (p.tune / 12);
    const filterQ = custom ? value(p, "filterQ", 3.5) : 3.5;
    const filter = this.filter("bandpass", filterFrequency, filterQ, time);
    const gain = this.gain(0, time);
    const duration = (custom ? value(p, "duration", 35) / 1000 : 0.035) * p.decay;
    this.decay(gain.gain, time, p.amplitude * (custom ? value(p, "toneLevel", 70) / 100 : 0.7), duration);
    [custom ? value(p, "lowFrequency", 1670) : 1670, custom ? value(p, "highFrequency", 2350) : 2350].forEach((frequency, index) => {
      const oscillator = this.oscillator("square", frequency * 2 ** (p.tune / 12), time);
      const balance = custom ? value(p, "balance", 50) / 100 : 0.5;
      oscillator.connect(this.gain(2 * (index ? balance : 1 - balance), time)).connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.015);
    });
    const noiseGain = this.gain(0, time);
    const independentNoise = custom && value(p, "noiseMode", 0) === 1;
    const noiseDuration = independentNoise ? value(p, "noiseDecay", 20) / 1000 * p.decay : Math.min(0.02, duration);
    this.decay(noiseGain.gain, time, p.amplitude * (custom ? value(p, "noiseLevel", 25) / 100 : 0.25), noiseDuration);
    // A separate filter keeps the crack out of the tone envelope without letting
    // the pitched partials bypass it. Linked mode retains the original graph.
    const noiseFilter = independentNoise ? this.filter("bandpass", filterFrequency, filterQ, time) : filter;
    this.noiseSource(time, independentNoise ? noiseDuration : 0.02).connect(noiseGain).connect(noiseFilter);
    if (independentNoise) noiseFilter.connect(bus);
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
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "duration", open ? 420 : 58) / 1000 : open ? 0.42 : 0.058) * p.decay;
    const metalDuration = custom && value(p, "metalDecay", 0) > 0 ? value(p, "metalDecay", 0) / 1000 * p.decay : duration;
    let destination: AudioNode = this.busses.get(open ? "oh" : "ch")!;
    if (!open) {
      this.hatChoke.close(time, (this.getPatch().voices.oh.custom.chokeRelease ?? 10) / 1000);
    } else if (value(p, "chokeMode", 0) === 1) {
      const gate = this.hatChoke.open(this.context!, destination, time, Math.max(duration, metalDuration));
      if (!gate) return;
      destination = gate;
    }
    const bus = this.brightnessDestination(time, p, destination);
    if (custom) {
      const noiseFilter = this.filter("highpass", value(p, "noiseHighpass", 7800) * 2 ** (p.tune / 24), 0.8, time);
      const noiseGain = this.gain(0, time);
      this.decay(noiseGain.gain, time, p.amplitude * value(p, "noiseLevel", 20) / 100, duration);
      this.noiseSource(time, duration).connect(noiseFilter).connect(noiseGain).connect(bus);
      this.metallic(time, metalDuration, p.tune, p.amplitude * value(p, "metalLevel", 50) / 100, bus, value(p, "highpass", 7400), value(p, "metalBase", 40));
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
    const overtone = custom ? value(p, "overtoneLevel", 0) / 100 : 0;
    const overtoneFrequency = base * value(p, "overtoneRatio", 1.5);
    if (overtone > 0 && overtoneFrequency < this.context!.sampleRate * 0.49) {
      const overtoneDecay = value(p, "overtoneDecay", 0);
      const overtoneDuration = overtoneDecay > 0 ? overtoneDecay / 1000 * p.decay : duration * 0.45;
      const mode = this.oscillator("sine", overtoneFrequency, time);
      const modeGain = this.gain(0, time);
      this.decay(modeGain.gain, time, p.amplitude * overtone * 0.45, overtoneDuration);
      mode.connect(modeGain).connect(bus);
      mode.start(time);
      mode.stop(time + overtoneDuration + 0.03);
    }
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
    const gain = this.gain(0, time);
    this.attackDecay(gain.gain, time, p.amplitude * (custom ? value(p, "toneLevel", 55) / 100 : 0.55), 0.003, duration);
    [custom ? value(p, "lowFrequency", 540) : 540, custom ? value(p, "highFrequency", 800) : 800].forEach((frequency, index) => {
      const oscillator = this.oscillator("square", frequency * 2 ** (p.tune / 12), time);
      const balance = custom ? value(p, "balance", 50) / 100 : 0.5;
      const level = 2 * (index ? balance : 1 - balance);
      const partial = this.gain(level, time);
      const damping = custom ? value(p, "highDamping", 0) / 100 : 0;
      if (index === 1 && level > 0 && damping > 0) {
        // Up to 60 dB of additional high-partial decay; continuous at zero.
        partial.gain.exponentialRampToValueAtTime(level * 10 ** (-3 * damping), time + Math.max(0.01, duration));
      }
      oscillator.connect(partial).connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
    });
    filter.connect(gain).connect(bus);
  }

  private cymbal(time: number, p: SynthParameters): void {
    const bus = this.brightnessDestination(time, p, this.busses.get("cym")!);
    const custom = p.machine === "custom";
    const duration = (custom ? value(p, "duration", 1400) / 1000 : p.machine === "909" ? 1.6 : 1.15) * p.decay;
    const metalDuration = custom && value(p, "metalDecay", 0) > 0 ? value(p, "metalDecay", 0) / 1000 * p.decay : duration;
    this.metallic(time, metalDuration, p.tune - 2, p.amplitude * (custom ? value(p, "metalLevel", 40) / 100 : 0.4), bus, custom ? value(p, "highpass", 4200) : 4200, custom ? value(p, "metalBase", 40) : 40);
    const filter = this.filter("highpass", custom ? value(p, "noiseHighpass", 5200) : 5200, 0.7, time);
    const gain = this.gain(0, time);
    this.decay(gain.gain, time, p.amplitude * (custom ? value(p, "noiseLevel", 32) / 100 : p.machine === "909" ? 0.4 : 0.22), duration);
    this.noiseSource(time, duration).connect(filter).connect(gain).connect(bus);
    if (custom && value(p, "bellLevel", 0) > 0) this.cymbalBell(time, p, bus);
    if (custom && value(p, "stickLevel", 0) > 0) this.cymbalStick(time, p, bus);
  }

  private cymbalStick(time: number, p: SynthParameters, destination: AudioNode): void {
    const duration = value(p, "stickDecay", 15) / 1000;
    const filter = this.filter("bandpass", value(p, "stickFilter", 4500) * 2 ** (p.tune / 24), 0.7, time);
    const gain = this.gain(0, time);
    this.attackDecay(gain.gain, time, p.amplitude * value(p, "stickLevel", 0) / 100, 0.001, duration);
    // Use the shared noise timeline without consuming extra rhythm randomness.
    this.noiseSource(time, duration, time % this.noise!.duration).connect(filter).connect(gain).connect(destination);
  }

  private cymbalBell(time: number, p: SynthParameters, destination: AudioNode): void {
    const frequency = value(p, "bellFrequency", 800) * 2 ** (p.tune / 12);
    const duration = value(p, "bellDecay", 500) / 1000 * p.decay;
    const amplitude = p.amplitude * value(p, "bellLevel", 0) / 100;
    // A compact additive bell: unit-sum weights, with upper modes damping sooner.
    // These are chosen timbres, not a model of a specific acoustic cymbal.
    const modes = [
      { ratio: 1, level: 0.6, decay: 1 },
      { ratio: 2.4, level: 0.25, decay: 0.6 },
      { ratio: 3.9, level: 0.15, decay: 0.35 },
    ];
    for (const mode of modes) {
      const pitch = frequency * mode.ratio;
      // Drop inaudible modes instead of piling them up at the frequency ceiling.
      if (pitch >= this.context!.sampleRate * 0.49) continue;
      const oscillator = this.oscillator("sine", pitch, time);
      const gain = this.gain(0, time);
      const length = Math.max(0.006, duration * mode.decay);
      this.attackDecay(gain.gain, time, amplitude * mode.level, 0.001, length);
      oscillator.connect(gain).connect(destination);
      oscillator.start(time);
      oscillator.stop(time + length + 0.03);
    }
  }

  private shaker(time: number, p: SynthParameters): void {
    const bus = this.busses.get("shk")!;
    const custom = p.machine === "custom";
    const attack = custom ? value(p, "attack", 6) / 1000 : 0.006;
    const duration = Math.max(attack + 0.005, (custom ? value(p, "duration", 75) / 1000 : 0.075) * p.decay);
    const filter = this.filter("bandpass", (custom ? value(p, "filterFrequency", 6200) : 6200) * 2 ** (p.tune / 24), custom ? value(p, "filterQ", 1.6) : 1.6, time);
    const gain = this.gain(0, time);
    const level = p.amplitude * (custom ? value(p, "noiseLevel", 50) / 100 : 0.5);
    this.attackDecay(gain.gain, time, level, attack, duration);
    const depth = custom ? value(p, "grainDepth", 0) / 100 : 0;
    if (depth > 0 && level > 0) {
      const texture = this.context!.createGain();
      const seed = Math.floor(time * this.context!.sampleRate) >>> 0;
      // This parameter owns only the curve: no overlapping point automation.
      texture.gain.setValueCurveAtTime(shakerTextureCurve(depth, value(p, "grainRate", 60), duration, seed), time, duration);
      filter.connect(texture).connect(gain);
    } else {
      filter.connect(gain);
    }
    this.noiseSource(time, duration).connect(filter);
    gain.connect(bus);
  }

  private bassline(time: number, p: SynthParameters): void {
    const bus = this.busses.get("bassline")!;
    const accentInput = value(p, "accentSource", 0) === 1 ? clamp(p.levelModulation, 0, 1) : 1;
    const accent = value(p, "accent", 30) / 100 * accentInput;
    const filterDuration = Math.max(0.06, value(p, "filterDecay", 260) / 1000 * p.decay) * (1 + accent * value(p, "accentDecay", 0) / 100);
    const ampDecay = value(p, "ampDecay", 0);
    const duration = ampDecay > 0 ? Math.max(0.01, ampDecay / 1000 * p.decay) : filterDuration;
    const cutoff = value(p, "cutoff", 700);
    const envelopeAmount = value(p, "envelopeAmount", 82) / 100;
    const filter = this.filter("lowpass", cutoff, value(p, "resonance", 12), time);
    const accentOctaves = 2 * accent * value(p, "accentFilter", 0) / 100;
    const peak = this.safeFrequency(Math.min(16000, cutoff * (1 + envelopeAmount * 10) * 2 ** accentOctaves));
    const gain = this.gain(0, time);
    this.attackDecay(gain.gain, time, p.amplitude * (0.72 + accent * 0.28), 0.004, duration);
    const note = this.beginSynthNote("bassline", bus, time, duration, p);
    if (!note) return;
    this.synthFilter(filter.frequency, note, peak, this.safeFrequency(Math.max(40, cutoff)), filterDuration, value(p, "filterTracking", 0), 16000);
    const oscillator = this.synthOscillator(value(p, "waveform", 0) >= 0.5 ? "square" : "sawtooth", note, 1, value(p, "pulseWidth", 50));
    oscillator.connect(filter).connect(gain).connect(note.output);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.04);
  }

  private lead(time: number, p: SynthParameters): void {
    const bus = this.busses.get("lead")!;
    const attack = value(p, "attack", 8) / 1000;
    const duration = Math.max(attack + 0.04, value(p, "release", 520) / 1000 * p.decay);
    const cutoff = value(p, "cutoff", 3200);
    const envelopeAmount = value(p, "envelopeAmount", 38) / 100;
    const filter = this.filter("lowpass", cutoff, value(p, "resonance", 3.5), time);
    const peak = this.safeFrequency(Math.min(18000, cutoff * (1 + envelopeAmount * 4)));
    const filterDecay = value(p, "filterDecay", 0);
    const filterDuration = filterDecay > 0 ? Math.max(0.01, filterDecay / 1000 * p.decay) : duration;
    const gain = this.gain(0, time);
    this.attackDecay(gain.gain, time, p.amplitude * 0.72, attack, duration);
    const note = this.beginSynthNote("lead", bus, time, duration, p);
    if (!note) return;
    this.synthFilter(filter.frequency, note, peak, this.safeFrequency(Math.max(80, cutoff)), filterDuration, value(p, "filterTracking", 0), 18000);
    const waveforms: OscillatorType[] = ["sawtooth", "square", "triangle"];
    const main = this.synthOscillator(waveforms[Math.round(value(p, "waveform", 0))] ?? "sawtooth", note, 1, value(p, "pulseWidth", 50));
    main.connect(filter);
    main.start(time);
    main.stop(time + duration + 0.04);
    const subLevel = value(p, "subLevel", 0) / 100;
    if (subLevel > 0) {
      const sub = this.synthOscillator("sine", note, 0.5);
      sub.connect(this.gain(subLevel, time)).connect(filter);
      sub.start(time);
      sub.stop(time + duration + 0.04);
    }
    const companionMix = value(p, "pulseMix", 28) / 100;
    if (companionMix > 0) {
      const companionGain = this.gain(companionMix, time);
      const companion = this.synthOscillator("square", note, 2 ** (value(p, "detune", 7) / 1200), value(p, "pulseWidth", 50));
      companion.connect(companionGain).connect(filter);
      companion.start(time);
      companion.stop(time + duration + 0.04);
    }
    filter.connect(gain).connect(note.output);
  }

  private beginSynthNote(id: "bassline" | "lead", bus: AudioNode, time: number, duration: number, p: SynthParameters): SynthNote | null {
    const mono = value(p, "playMode", 0) === 1;
    return this.synthArticulation[id].begin(this.context!, bus, time, duration + 0.005, mono ? this.safeFrequency(p.frequency) : p.frequency, mono, value(p, "glide", 0) / 1000);
  }

  private synthFilter(parameter: AudioParam, note: SynthNote, peak: number, resting: number, duration: number, tracking: number, ceiling: number): void {
    const points = synthFilterSweep({
      start: note.start, duration, peak, resting, from: this.safeFrequency(note.from), target: this.safeFrequency(note.target),
      glideEnd: note.glideEnd, tracking: tracking / 100, ceiling: this.safeFrequency(ceiling),
    });
    parameter.setValueAtTime(points[0].frequency, points[0].time);
    for (const point of points.slice(1)) parameter.exponentialRampToValueAtTime(point.frequency, point.time);
  }

  private synthOscillator(type: OscillatorType, note: SynthNote, ratio = 1, pulseWidth = 50): OscillatorNode {
    const oscillator = this.oscillator(type, note.from * ratio, note.start);
    const width = Math.round(clamp(pulseWidth, 10, 90));
    if (type === "square" && width !== 50) oscillator.setPeriodicWave(this.pulseWave(width));
    if (note.glideEnd > note.start) {
      oscillator.frequency.exponentialRampToValueAtTime(this.safeFrequency(note.target * ratio), note.glideEnd);
    }
    return oscillator;
  }

  private pulseWave(width: number): PeriodicWave {
    let wave = this.pulseWaves.get(width);
    if (wave) {
      this.pulseWaves.delete(width); // Refresh recency without rebuilding the wave.
    } else {
      const { real, imag } = pulseWaveCoefficients(width);
      wave = this.context!.createPeriodicWave(real, imag, { disableNormalization: false });
      // Bound retained native tables while users explore widths during playback.
      if (this.pulseWaves.size >= 8) this.pulseWaves.delete(this.pulseWaves.keys().next().value!);
    }
    this.pulseWaves.set(width, wave);
    return wave;
  }
}

interface SynthParameters {
  machine: Machine;
  tune: number;
  decay: number;
  amplitude: number;
  levelModulation: number;
  frequency: number;
  custom: CustomVoiceSettings;
}

const value = (parameters: SynthParameters, key: string, fallback: number) => parameters.custom[key] ?? fallback;
