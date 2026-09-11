/**
 * AudioWorkletGlobalScope declarations.
 *
 * TypeScript's DOM lib describes the main thread, not the audio thread, so these
 * globals are invisible without help. Declaring them here keeps worklet code
 * fully type-checked rather than islanded behind `any`.
 */

declare global {
  class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor(options?: AudioWorkletNodeOptions);
    process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ): boolean;
  }

  function registerProcessor(
    name: string,
    processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
  ): void;

  /** Sample index of the first frame of the current render quantum. */
  const currentFrame: number;
  /** AudioContext time at the start of the current render quantum, in seconds. */
  const currentTime: number;
  /** Sample rate of the context this worklet is running in. Never assume 44100. */
  const sampleRate: number;
}

export {};
