import { VoicePool, type EnvelopeParams } from '@/audio/dsp/polyphony';
import type { VoiceParams } from '@/audio/dsp/voice';
import type { ToWorklet, VoiceReport } from '@/audio/protocol';

/**
 * Virtual-analog synth processor.
 *
 * Deliberately thin: voice allocation and DSP live in `@/audio/dsp/*` where they
 * are unit-tested on the main thread. What is genuinely worklet-specific — the
 * AudioParam surface, and turning scheduled times into sample offsets — is all
 * that lives here.
 */

/** How often to report voice usage to the main thread. ~10 Hz is plenty for a meter. */
const REPORT_INTERVAL_QUANTA = 40;

const EMPTY = new Float32Array(1);

interface ScheduledNote {
  midi: number;
  velocity: number;
  time: number;
  on: boolean;
}

class VaProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    // All k-rate: one value per 128-sample quantum, which is a ~375 Hz control
    // rate. Faders are ramped on the main thread with setTargetAtTime, so that
    // is smooth enough to avoid zipper noise while keeping the per-sample loop
    // free of array indexing.
    const k = 'k-rate' as const;
    return [
      { name: 'wave', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: k },
      {
        name: 'width',
        defaultValue: 0.5,
        minValue: 0.05,
        maxValue: 0.95,
        automationRate: k,
      },
      { name: 'detune', defaultValue: 8, minValue: 0, maxValue: 40, automationRate: k },
      { name: 'sub', defaultValue: 0.25, minValue: 0, maxValue: 1, automationRate: k },
      {
        name: 'attack',
        defaultValue: 0.005,
        minValue: 0.001,
        maxValue: 4,
        automationRate: k,
      },
      {
        name: 'decay',
        defaultValue: 0.25,
        minValue: 0.001,
        maxValue: 4,
        automationRate: k,
      },
      { name: 'sustain', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: k },
      {
        name: 'release',
        defaultValue: 0.3,
        minValue: 0.001,
        maxValue: 8,
        automationRate: k,
      },
      {
        name: 'cutoff',
        defaultValue: 3000,
        minValue: 20,
        maxValue: 18000,
        automationRate: k,
      },
      {
        name: 'resonance',
        defaultValue: 0.15,
        minValue: 0,
        maxValue: 1,
        automationRate: k,
      },
      { name: 'drive', defaultValue: 0.1, minValue: 0, maxValue: 1, automationRate: k },
      { name: 'level', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: k },
    ];
  }

  private pool: VoicePool;
  private queue: ScheduledNote[] = [];
  private quantaSinceReport = 0;

  // Reused every quantum. Allocating these per block would hand the garbage
  // collector work on the audio thread, and a GC pause is an audible dropout.
  private readonly voiceParams: VoiceParams = {
    wave: 0,
    width: 0.5,
    detune: 8,
    sub: 0.25,
    cutoff: 3000,
    resonance: 0.15,
    drive: 0.1,
  };
  private readonly envParams: EnvelopeParams = {
    attack: 0.005,
    decay: 0.25,
    sustain: 0.7,
    release: 0.3,
  };

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);
    const processorOptions = options?.processorOptions as { voices?: number } | undefined;
    const voices = processorOptions?.voices ?? 8;
    this.pool = new VoicePool(sampleRate, voices);
    this.port.onmessage = (event: MessageEvent<ToWorklet>) => {
      this.handle(event.data);
    };
  }

  private handle(message: ToWorklet): void {
    switch (message.type) {
      case 'noteOn':
        this.enqueue({
          midi: message.midi,
          velocity: message.velocity,
          time: message.time,
          on: true,
        });
        break;
      case 'noteOff':
        this.enqueue({ midi: message.midi, velocity: 0, time: message.time, on: false });
        break;
      case 'allNotesOff':
        this.queue.length = 0;
        this.pool.allNotesOff();
        break;
      case 'setPolyphony':
        this.queue.length = 0;
        this.pool.resize(message.voices);
        break;
    }
  }

  /** Keep the queue ordered by time so the render loop only inspects the head. */
  private enqueue(note: ScheduledNote): void {
    let i = this.queue.length;
    while (i > 0 && (this.queue[i - 1]?.time ?? 0) > note.time) i--;
    this.queue.splice(i, 0, note);
  }

  private readParams(parameters: Record<string, Float32Array>): void {
    const read = (name: string): number => (parameters[name] ?? EMPTY)[0] ?? 0;
    this.voiceParams.wave = read('wave');
    this.voiceParams.width = read('width');
    this.voiceParams.detune = read('detune');
    this.voiceParams.sub = read('sub');
    this.voiceParams.cutoff = read('cutoff');
    this.voiceParams.resonance = read('resonance');
    this.voiceParams.drive = read('drive');
    this.envParams.attack = read('attack');
    this.envParams.decay = read('decay');
    this.envParams.sustain = read('sustain');
    this.envParams.release = read('release');
  }

  override process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    const left = output?.[0];
    if (!left) return true;

    this.readParams(parameters);
    this.pool.updateEnvelopes(this.envParams);
    this.pool.prepare(this.voiceParams);

    const level = (parameters.level ?? EMPTY)[0] ?? 0;
    const secondsPerSample = 1 / sampleRate;

    for (let i = 0; i < left.length; i++) {
      // Dispatch every note due at or before this exact sample. This is what
      // makes timing sample-accurate rather than quantised to a 128-sample block,
      // and it is why the M4 sequencer can be built on this without revisiting it.
      const sampleTime = currentTime + i * secondsPerSample;
      let started = false;
      while (this.queue.length > 0 && (this.queue[0]?.time ?? Infinity) <= sampleTime) {
        const note = this.queue.shift();
        if (!note) break;
        if (note.on) {
          this.pool.noteOn(note.midi, note.velocity, this.envParams);
          started = true;
        } else {
          this.pool.noteOff(note.midi);
        }
      }
      // A voice started mid-block has no oscillator increments yet, so prepare it
      // now rather than letting it render a sample of silence or garbage.
      if (started) this.pool.prepare(this.voiceParams);

      left[i] = this.pool.render() * level;
    }

    // Mono voices, duplicated across channels. Stereo width arrives with V2 effects.
    for (let ch = 1; ch < output.length; ch++) output[ch]?.set(left);

    if (++this.quantaSinceReport >= REPORT_INTERVAL_QUANTA) {
      this.quantaSinceReport = 0;
      const report: VoiceReport = {
        type: 'voices',
        active: this.pool.activeCount,
        max: this.pool.size,
      };
      this.port.postMessage(report);
    }

    return true;
  }
}

registerProcessor('va-synth', VaProcessor);
