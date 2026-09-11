/**
 * ADSR envelope, one sample at a time.
 *
 * Linear attack (punchier and predictable), exponential decay and release
 * (how analog circuits actually behave, and far kinder on the ear).
 *
 * Retriggering ramps from wherever the envelope currently is rather than
 * snapping to zero, which is what stops fast repeated notes from clicking.
 */

export const STAGE = {
  Idle: 0,
  Attack: 1,
  Decay: 2,
  Sustain: 3,
  Release: 4,
} as const;
export type Stage = (typeof STAGE)[keyof typeof STAGE];

/** Below this the envelope is inaudible (-80 dB), so we stop and free the voice. */
const SILENCE = 1e-4;

/** Per-sample coefficient for an exponential approach to a target. */
const coefficient = (seconds: number, sampleRate: number): number => {
  const samples = Math.max(1, seconds * sampleRate);
  return 1 - Math.exp(-1 / samples);
};

export class Adsr {
  private stage: Stage = STAGE.Idle;
  private value = 0;

  private attack = 0.005;
  private decay = 0.2;
  private sustain = 0.7;
  private release = 0.3;
  private sampleRate = 48000;

  private attackStep = 0;
  private decayCoef = 0;
  private releaseCoef = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.recalculate();
  }

  setParams(attack: number, decay: number, sustain: number, release: number): void {
    this.attack = attack;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;
    this.recalculate();
  }

  private recalculate(): void {
    this.attackStep = 1 / Math.max(1, this.attack * this.sampleRate);
    this.decayCoef = coefficient(this.decay, this.sampleRate);
    this.releaseCoef = coefficient(this.release, this.sampleRate);
  }

  gateOn(): void {
    this.stage = STAGE.Attack;
  }

  gateOff(): void {
    if (this.stage !== STAGE.Idle) this.stage = STAGE.Release;
  }

  /** Cut immediately — used when a voice is stolen. */
  reset(): void {
    this.stage = STAGE.Idle;
    this.value = 0;
  }

  get isActive(): boolean {
    return this.stage !== STAGE.Idle;
  }

  get currentStage(): Stage {
    return this.stage;
  }

  get level(): number {
    return this.value;
  }

  process(): number {
    switch (this.stage) {
      case STAGE.Idle:
        return 0;

      case STAGE.Attack:
        this.value += this.attackStep;
        if (this.value >= 1) {
          this.value = 1;
          this.stage = STAGE.Decay;
        }
        break;

      case STAGE.Decay:
        this.value += (this.sustain - this.value) * this.decayCoef;
        // Close enough to sustain that further decay is inaudible.
        if (Math.abs(this.value - this.sustain) < SILENCE) {
          this.value = this.sustain;
          this.stage = STAGE.Sustain;
        }
        break;

      case STAGE.Sustain:
        this.value = this.sustain;
        break;

      case STAGE.Release:
        this.value -= this.value * this.releaseCoef;
        if (this.value < SILENCE) {
          this.value = 0;
          this.stage = STAGE.Idle;
        }
        break;
    }
    return this.value;
  }
}
