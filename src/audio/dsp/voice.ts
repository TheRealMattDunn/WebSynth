import { centsToRatio, midiToFrequency } from '@/core/notes';
import { Adsr, STAGE } from './adsr';
import { advance, polyBlepPulse, polyBlepSaw } from './polyblep';
import { softClip, Svf } from './svf';

/** Patch parameters, shared by every voice. Read once per render quantum. */
export interface VoiceParams {
  wave: number;
  width: number;
  detune: number;
  sub: number;
  cutoff: number;
  resonance: number;
  drive: number;
}

/**
 * One virtual-analog voice: two detuned anti-aliased oscillators plus a sine
 * sub, through a resonant filter, into an amplitude envelope.
 *
 * Lives in dsp/ rather than inside the worklet so it can be tested on the main
 * thread — the worklet file stays a thin shell around parts that are already
 * verified.
 *
 * NOTE ON STRUCTURE: `prepare()` is called once per render quantum and
 * `render()` once per sample. Everything transcendental — tan() in the filter
 * coefficients, pow() in the pitch and detune maths — belongs in `prepare()`.
 * Doing that work per sample costs roughly a million extra transcendental calls
 * a second at eight-voice polyphony, which is comfortably enough to cause
 * dropouts on a phone.
 */
export class Voice {
  midi = -1;
  /** Monotonic counter, used to pick the oldest voice when stealing. */
  age = 0;

  private phase1 = 0;
  private phase2 = 0;
  private phaseSub = 0;
  private velocity = 1;

  private dt1 = 0;
  private dt2 = 0;
  private dtSub = 0;
  private wave = 0;
  private width = 0.5;
  private sub = 0;
  private driveGain = 1;
  private subScale = 1;

  private readonly env: Adsr;
  private readonly filter: Svf;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.env = new Adsr(sampleRate);
    this.filter = new Svf(sampleRate);
  }

  get isActive(): boolean {
    return this.env.isActive;
  }

  get isReleasing(): boolean {
    return this.env.currentStage === STAGE.Release;
  }

  get level(): number {
    return this.env.level;
  }

  setEnvelope(attack: number, decay: number, sustain: number, release: number): void {
    this.env.setParams(attack, decay, sustain, release);
  }

  noteOn(midi: number, velocity: number, age: number): void {
    // Only reset phase for a genuinely new voice. Retriggering the same note
    // mid-release keeps its phase, which avoids a click at the join.
    if (this.midi !== midi || !this.env.isActive) {
      this.phase1 = 0;
      // A quarter cycle apart so the two oscillators do not start in lockstep
      // and briefly sum into one louder oscillator.
      this.phase2 = 0.25;
      this.phaseSub = 0;
      this.filter.reset();
    }
    this.midi = midi;
    this.velocity = velocity;
    this.age = age;
    this.env.gateOn();
  }

  noteOff(): void {
    this.env.gateOff();
  }

  /** Immediate silence, for voice stealing. */
  kill(): void {
    this.env.reset();
    this.filter.reset();
    this.midi = -1;
  }

  /** Per-render-quantum setup. All the expensive maths lives here. */
  prepare(p: VoiceParams): void {
    if (!this.env.isActive) return;

    const base = midiToFrequency(this.midi);
    const spread = p.detune * 0.5;
    this.dt1 = (base * centsToRatio(-spread)) / this.sampleRate;
    this.dt2 = (base * centsToRatio(spread)) / this.sampleRate;
    this.dtSub = this.dt1 * 0.5;

    this.wave = p.wave;
    this.width = p.width;
    this.sub = p.sub;
    this.subScale = 1 / (1 + p.sub);
    this.driveGain = 1 + p.drive * 4;

    this.filter.set(p.cutoff, p.resonance);
  }

  /** One sample. Returns 0 when idle so the caller need not branch. */
  render(): number {
    if (!this.env.isActive) return 0;

    let osc =
      this.wave < 0.5
        ? polyBlepSaw(this.phase1, this.dt1) + polyBlepSaw(this.phase2, this.dt2)
        : polyBlepPulse(this.phase1, this.dt1, this.width) +
          polyBlepPulse(this.phase2, this.dt2, this.width);
    osc *= 0.5;

    if (this.sub > 0) {
      osc = (osc + Math.sin(2 * Math.PI * this.phaseSub) * this.sub) * this.subScale;
    }

    this.phase1 = advance(this.phase1, this.dt1);
    this.phase2 = advance(this.phase2, this.dt2);
    this.phaseSub = advance(this.phaseSub, this.dtSub);

    // Classic VCF -> VCA order: drive and filter shape the tone, the envelope
    // then opens the amplifier. Filtering after the envelope smears the attack.
    const driven = this.driveGain > 1 ? softClip(osc * this.driveGain) : osc;
    const filtered = this.filter.processLowpass(driven);

    return filtered * this.env.process() * this.velocity;
  }
}
