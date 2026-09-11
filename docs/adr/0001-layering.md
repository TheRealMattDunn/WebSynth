# 0001 — Layer boundaries enforced by lint

**Status:** accepted · M0

## Context

This project is meant to grow over several milestones, and the most likely way for it
to rot is for React to creep into the audio path — a component reaching into the
engine, an audio object landing in a store, a DSP module importing a hook "just for
now".

React responds to human-speed events. The audio thread must hit a 128-sample deadline
roughly every 2.7 ms, forever. Dropouts caused by that boundary eroding are miserable
to diagnose after the fact, because by then the coupling is everywhere.

## Decision

Four layers, dependencies pointing one way: `core ← audio ← ui ← app`.

Enforced by `no-restricted-imports` in `eslint.config.js`, which fails CI:

- `core/**` may not import React, UI, audio implementation, or `zustand/react`
- `audio/**` may not import React, UI, or zustand at all
- `ui/**` may not import `app/**`

The store is `zustand/vanilla` so `core/` stays framework-free;
`src/ui/hooks/useInstrument.ts` is the only place React and the store meet.

## Consequences

- A violation is a build failure, not a review comment somebody might miss.
- The cost is real: shared constants must live somewhere legitimate rather than
  wherever is convenient. The `BRAND` constant was caught by this rule on its first
  run and moved from `app/` to `core/`, which was the correct outcome.
- `core/` and most of `audio/` are unit-testable without a DOM or an AudioContext.
