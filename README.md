# TYPE-4

**A four-control web instrument.**

A browser synthesiser built around a single constraint: every screen exposes exactly
four continuous parameters. Never five.

The constraint is the product. It forces a real editorial decision about what matters
in each sound engine, it makes the instrument learnable in about ten seconds, and it
means a patch reads at a glance — four faders, one bar chart.

Loosely inspired by the ethos of the Teenage Engineering OP-1 — few engines, a narrow
control surface, no menus — without being a clone of it.

## Play it

```bash
npm install
npm run dev
```

Press **A–L** to play, **Z/X** to change octave, or use the on-screen keyboard.

To play it on a tablet — the device it is designed around — run
`npm run dev -- --host` and open the printed network address.

## What is here

**M1: a playable virtual-analog synthesiser.**

- Two anti-aliased oscillators plus a sub, through a resonant state-variable filter
  into an ADSR envelope, rendered by a custom `AudioWorklet`
- Adaptive polyphony with voice stealing
- Sample-accurate note scheduling
- Multi-touch keyboard, a pad grid on phones, and a QWERTY mapping
- Light and dark themes
- 110 unit tests over the DSP and domain layers

**Not yet:** FM and Karplus-Strong engines (M2), drums (M3), sequencing (M4),
persistence and sharing (M5). See the roadmap in
[`docs/architecture.md`](docs/architecture.md).

## Design

Swiss, editorial, restrained. Paper ground, ink type, one hot accent, a strict 8px
rhythm, tabular figures so readouts do not jitter. The name reads as a model number,
but the instrument is genuinely built out of type.

Four **vertical faders** rather than rotary knobs — they read as a bar chart, so you
comprehend a whole patch in one glance, and a linear drag is a gesture people can
actually perform accurately on glass.

The **tablet in landscape is the reference design**. Desktop is that layout centred
with a computer keyboard added; phone is it folded down, with the two-octave keyboard
becoming a 4×3 pad grid because 24 piano keys at 390 px gives ~16 px per key.

## Engineering notes

The interesting parts, in brief — the long version is in
[`docs/architecture.md`](docs/architecture.md) and the
[ADRs](docs/adr).

- **Real anti-aliasing.** A naive digital saw is four lines of code and sounds like a
  fax machine above the fifth octave. `polyblep.ts` band-limits the discontinuity, and
  the test suite proves it: play a 7 kHz saw, assert there is no energy below the
  fundamental.
- **Layer boundaries enforced by lint.** `core ← audio ← ui ← app`. `audio/` and
  `core/` cannot import React, and CI fails if they try.
- **The design law is a type.** `ControlQuad` is a 4-tuple, so a fifth control is a
  compile error rather than a code review comment.
- **Nothing expensive per sample.** `tan()` and `pow()` run once per 128-sample block,
  not once per sample — the difference is about a million transcendental calls a
  second, which is the difference between working and crackling on a phone.
- **Worklets bundled by a custom Vite plugin,** because Vite's built-in serves live ES
  imports in dev and `AudioWorkletGlobalScope` has no module loader in Safari. Dev and
  production now behave identically.

## Stack

TypeScript (strict, plus `noUncheckedIndexedAccess` and `erasableSyntaxOnly`) · React 19 ·
Vite 8 · Vitest · zustand. No audio libraries — the DSP is written from scratch.

## Licence

MIT
