import vaWorkletUrl from './worklets/va.worklet.ts?audio-worklet';
import { detectDevice, recommendedVoices } from './polyphony-budget';
import type { FromWorklet, ToWorklet } from './protocol';

/**
 * Owns the AudioContext and everything hanging off it.
 *
 * Framework-free by design (enforced by lint — see eslint.config.js): the UI
 * calls methods on this, and nothing here knows React exists. That boundary is
 * what keeps React's render cycle off the audio path.
 */

export type EngineStatus = 'idle' | 'starting' | 'running' | 'error';

export interface EngineListener {
  onStatus?: (status: EngineStatus, error?: string) => void;
  onVoices?: (active: number, max: number) => void;
}

/** Ramp time for parameter changes. Long enough to avoid zipper noise, short enough to feel instant. */
const PARAM_SMOOTHING = 0.02;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private synth: AudioWorkletNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private status: EngineStatus = 'idle';
  private listener: EngineListener = {};
  private startPromise: Promise<void> | null = null;
  private pendingParams = new Map<string, number>();

  setListener(listener: EngineListener): void {
    this.listener = listener;
  }

  get isRunning(): boolean {
    return this.status === 'running';
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private setStatus(status: EngineStatus, error?: string): void {
    this.status = status;
    this.listener.onStatus?.(status, error);
  }

  /**
   * Must be called from inside a real user gesture — a pointerdown or keydown
   * handler, not a timeout or a promise continuation. Every browser blocks audio
   * that starts without one, and Safari is the strictest about what counts.
   *
   * Safe to call repeatedly; the work happens once.
   */
  async start(): Promise<void> {
    if (this.status === 'running') return;
    this.startPromise ??= this.boot();
    return this.startPromise;
  }

  private async boot(): Promise<void> {
    this.setStatus('starting');
    try {
      // Declared before the context exists so iOS applies it from the outset.
      // See src/types/audio-session.d.ts for why this matters.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';

      // Never pass an explicit sampleRate: the hardware rate differs between
      // devices (and between Safari and Chrome on the same device), and forcing
      // one makes the browser resample everything for no benefit.
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx = ctx;

      await ctx.audioWorklet.addModule(vaWorkletUrl);

      const voices = recommendedVoices(detectDevice());
      const synth = new AudioWorkletNode(ctx, 'va-synth', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { voices },
      });
      synth.port.onmessage = (event: MessageEvent<FromWorklet>) => {
        if (event.data.type === 'voices') {
          this.listener.onVoices?.(event.data.active, event.data.max);
        }
      };

      const master = new GainNode(ctx, { gain: 0.9 });
      const analyser = new AnalyserNode(ctx, {
        fftSize: 2048,
        smoothingTimeConstant: 0.6,
      });

      synth.connect(master).connect(analyser).connect(ctx.destination);

      this.synth = synth;
      this.master = master;
      this.analyser = analyser;

      // Anything the UI set before audio existed.
      for (const [id, value] of this.pendingParams) this.setParam(id, value);
      this.pendingParams.clear();

      await ctx.resume();
      this.watchLifecycle(ctx);
      this.setStatus('running');
    } catch (error) {
      this.startPromise = null;
      this.setStatus('error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * iOS suspends the context when the app is backgrounded or the screen locks,
   * and does not resume it on return. Without this the instrument comes back
   * silent and looks broken.
   */
  private watchLifecycle(ctx: AudioContext): void {
    const resume = () => {
      if (document.visibilityState === 'visible' && ctx.state === 'suspended') {
        void ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', resume);
    // Releasing held notes on blur avoids a note hanging forever when focus
    // leaves mid-keypress and the keyup never arrives.
    window.addEventListener('blur', () => {
      this.allNotesOff();
    });
  }

  private post(message: ToWorklet): void {
    this.synth?.port.postMessage(message);
  }

  /** @param time AudioContext time; defaults to now. */
  noteOn(midi: number, velocity = 1, time?: number): void {
    if (!this.ctx) return;
    this.post({ type: 'noteOn', midi, velocity, time: time ?? this.ctx.currentTime });
  }

  noteOff(midi: number, time?: number): void {
    if (!this.ctx) return;
    this.post({ type: 'noteOff', midi, time: time ?? this.ctx.currentTime });
  }

  allNotesOff(): void {
    this.post({ type: 'allNotesOff' });
  }

  /**
   * Parameter changes are ramped rather than set, because an instantaneous jump
   * in cutoff or level is audible as a click on every fader movement.
   */
  setParam(id: string, value: number): void {
    const ctx = this.ctx;
    const synth = this.synth;
    if (!ctx || !synth) {
      this.pendingParams.set(id, value);
      return;
    }
    const param = synth.parameters.get(id);
    if (!param) return;
    param.setTargetAtTime(value, ctx.currentTime, PARAM_SMOOTHING);
  }

  setMasterGain(gain: number): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(gain, this.ctx.currentTime, PARAM_SMOOTHING);
  }

  async dispose(): Promise<void> {
    this.allNotesOff();
    this.synth?.disconnect();
    this.master?.disconnect();
    this.analyser?.disconnect();
    await this.ctx?.close();
    this.ctx = null;
    this.synth = null;
    this.master = null;
    this.analyser = null;
    this.startPromise = null;
    this.setStatus('idle');
  }
}
