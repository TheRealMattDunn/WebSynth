# TYPE-4 — working notes

A browser synthesiser built around one constraint: **every screen exposes exactly four
continuous parameters.** Loosely inspired by the Teenage Engineering OP-1's ethos —
few engines, a deliberately narrow control surface — but not a clone of it.

Read [`docs/architecture.md`](docs/architecture.md) before making structural changes.

## Commands

```bash
npm run dev          # dev server
npm run dev -- --host   # reachable from a tablet on the same network
npm run verify       # typecheck + lint + format + test + build — run before pushing
npm test             # unit tests
```

## Rules that are not negotiable

1. **Four controls per page.** `ControlQuad` is a 4-tuple; a fifth is a compile error.
   Do not widen it. Add a page instead. ([ADR 0003](docs/adr/0003-four-control-law.md))

2. **Layer boundaries.** `core ← audio ← ui ← app`. ESLint fails the build on a
   violation. `audio/` and `core/` must never import React.
   ([ADR 0001](docs/adr/0001-layering.md))

3. **Nothing expensive per sample.** `Voice.prepare()` runs once per 128-sample block;
   `Voice.render()` runs per sample. `tan()`, `pow()`, `Math.log()` and allocation
   belong in `prepare()` or earlier. Allocating in the audio thread invites a GC pause,
   and a GC pause is an audible dropout.

4. **Never hardcode a sample rate.** Read it from the context. Safari and Chrome
   disagree, on the same device.

5. **Worklets import via `?audio-worklet`**, never `?worker&url`.
   ([ADR 0002](docs/adr/0002-audio-worklet-bundling.md))

6. **Touch is a first-class input.** New interactive controls need Pointer Events
   tracked by `pointerId`, `touch-action: none`, pointer capture, and a ≥44 px target.

## Where things live

```
src/core/    domain — control specs, patches, notes, timing, store. No React, no audio.
src/audio/   AudioContext, worklets, DSP. No React.
  dsp/       pure, unit-tested. The real work happens here.
  worklets/  thin shells around dsp/.
src/ui/      React. Commands the engine; never owns audio state.
src/app/     wiring.
plugins/     the worklet bundler.
```

## Testing posture

Test the pure layers — DSP, timing, control scaling, store. Do **not** write unit tests
against `AudioContext` or React components; mocking `AudioContext` only tests the mock.
Verify those by driving a real browser (see `CONTRIBUTING.md`).

DSP tests should measure, not assert vibes. `polyblep.test.ts` plays a 7 kHz saw and
checks there is no energy below the fundamental — that is a claim that would be false
for a naive oscillator.

## Current state

M0 (foundation) and M1 (playable virtual-analog synth) are complete. M2 adds FM and
Karplus-Strong engines; M4 adds the sequencer and the `Transport` clock that
`core/sequencer/timing.ts` is already waiting for.
