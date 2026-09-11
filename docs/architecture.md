# Architecture

## The design law

**Every screen exposes exactly four continuous parameters.** Not three, not five.

This is not a style guide entry, it is a type:

```ts
export type ControlQuad = readonly [ControlSpec, ControlSpec, ControlSpec, ControlSpec];
```

A fifth control is a compile error. `src/core/engines/engines.test.ts` asserts the
same property at test time across every engine, so the law survives contributors who
have never read this file.

## Layers

Dependencies point one way. This is enforced by ESLint (`no-restricted-imports` in
`eslint.config.js`), not by good intentions — a violation fails CI.

```
core  ←  audio  ←  ui  ←  app
```

| Layer        | Contains                                                            | May not import                  |
| ------------ | ------------------------------------------------------------------- | ------------------------------- |
| `src/core/`  | Domain: control specs, patches, note maths, sequencer timing, store | React, audio implementation, UI |
| `src/audio/` | AudioContext, worklets, DSP                                         | React, zustand, UI              |
| `src/ui/`    | React components and hooks                                          | `app/`                          |
| `src/app/`   | Wiring and composition                                              | —                               |

`core/` uses `zustand/vanilla` rather than the React binding, so the store is
testable and reasonable about without React in the picture. `src/ui/hooks/useInstrument.ts`
is the single place the two meet.

### Why the boundary matters

React's job is to respond to human-speed events. The audio thread's job is to hit a
128-sample deadline, roughly every 2.7 ms, forever. Anything that lets the first
leak into the second produces dropouts that are miserable to diagnose. So:

- The UI calls imperative methods on `AudioEngine`. Nothing flows back through React
  state per frame.
- The scope reads the `AnalyserNode` inside `requestAnimationFrame` and draws straight
  to canvas.
- Parameter changes are pushed by a store subscription in `useAudio.ts`, independent
  of which components happen to be mounted.

## Audio

### Worklet bundling

Worklet code must arrive as **one file with nothing left to resolve** —
`AudioWorkletGlobalScope` has no module loader in Safari. `plugins/vite-plugin-audio-worklet.ts`
bundles `*.worklet.ts` with esbuild into a self-contained IIFE, in dev and in
production alike. See [ADR 0002](adr/0002-audio-worklet-bundling.md) for why Vite's
built-in `?worker&url` was not enough.

```ts
import vaWorkletUrl from './worklets/va.worklet.ts?audio-worklet';
await ctx.audioWorklet.addModule(vaWorkletUrl);
```

### Voice architecture

One `AudioWorkletProcessor` per engine, rendering all its voices internally, rather
than a node per voice. Fewer nodes, no message churn per note, and voice stealing can
see every voice at once.

The worklet itself is deliberately thin. All the DSP lives in `src/audio/dsp/` where
it runs — and is tested — on the main thread.

### The per-block / per-sample split

`Voice.prepare()` runs once per 128-sample quantum. `Voice.render()` runs once per
sample. **Everything transcendental belongs in `prepare()`**: `tan()` for filter
coefficients, `pow()` for pitch and detune. Doing that work per sample costs roughly a
million extra transcendental calls a second at eight-voice polyphony, which is
comfortably enough to cause dropouts on a phone.

### Note timing

Note events carry an absolute `AudioContext` time. The processor converts that to a
sample offset inside the current quantum and triggers the voice on that exact sample,
rather than rounding to the nearest block. This is why the M4 sequencer can be built
on top of this without revisiting it.

### Anti-aliasing

`src/audio/dsp/polyblep.ts`. A naive saw is four lines and sounds like a fax machine
above the fifth octave, because everything above Nyquist folds back down as inharmonic
tones that slide the wrong way as you play up the keyboard. `polyblep.test.ts` plays a
7 kHz saw and asserts there is no energy below the fundamental — a claim that would be
false for a naive oscillator.

## Responsive

**The tablet in landscape is the reference design.** Desktop is that layout centred
with a QWERTY mapping added; phone is it folded down. Designing outward from the middle
avoids the usual failure of squashing a desktop app until it stops working.

| Width       | Layout                                         |
| ----------- | ---------------------------------------------- |
| < 600 px    | One column; keyboard becomes a 4×3 pad grid    |
| 600–1024 px | **Reference.**                                 |
| > 1024 px   | Same layout, centred, max width, QWERTY active |

Two octaves of piano keys at 390 px gives ~16 px per key, which is not an instrument.
Below 600 px `Keys` is therefore replaced by `Pads` — the better touch target at that
size, and the same component the drum machine needs in M3.

### Touch

All of this is cheap now and painful to retrofit:

- **Pointer Events tracked by `pointerId`** (`useNoteTargets.ts`), so chords work.
  A synth that sounds one note at a time under a finger is broken.
- `touch-action: none` plus `setPointerCapture`, so a drag that strays off a fader
  keeps controlling it and never scrolls the page.
- `user-select: none` and `-webkit-touch-callout: none`, or a long press on a pad pops
  a selection menu mid-performance.
- `viewport-fit=cover` plus `env(safe-area-inset-*)`.
- Pointers resolve through `document.elementFromPoint`, so sliding across the keyboard
  glisses instead of holding the first key you landed on.

### iOS

Three separate traps, each a small fix and a silent, baffling failure if missed:

1. **Audio needs a real user gesture.** Hence the start overlay.
2. **The hardware silent switch mutes Web Audio** unless `navigator.audioSession.type`
   is `'playback'`. Set in `AudioEngine.boot()` before the context is created.
3. **Backgrounding suspends the context** and does not resume it. Handled on
   `visibilitychange`.

Test on a real device; the simulator lies about audio.

## What we do and don't test

**Tested** — the pure layers, where a test means something:

- `audio/dsp/**` — oscillators, envelope, filter, voice pool. Real measurements: no
  NaN, bounded output, measured frequency matches requested pitch, anti-aliasing
  actually works, no sample-to-sample jumps that would be audible as clicks.
- `core/sequencer/timing.ts` — step maths, swing, window scheduling without gaps or
  double-scheduling.
- `core/controls`, `core/patch`, `core/store`, `core/notes`.
- `audio/polyphony-budget.ts`.

**Not unit-tested, deliberately** — the audio graph and React components. Mocking
`AudioContext` tests the mock. These are verified by driving a real browser instead;
see the checklist in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Roadmap

M0/M1 are done. Next:

- **M2** FM and Karplus-Strong engines, engine switching.
- **M3** Synthesised drum kit — no sample assets ship.
- **M4** Step sequencer and live loop recorder. The `Transport` clock lands here, built
  on `core/sequencer/timing.ts`.
- **M5** Patch save/recall, project JSON, share URLs, WAV export.
- **V2** Mic and line sampling, Web MIDI, effects.
