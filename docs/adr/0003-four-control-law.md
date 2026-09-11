# 0003 — The Four-Control Law lives in the type system

**Status:** accepted · M0

## Context

TYPE-4 is built around a single constraint: every screen exposes exactly four
continuous parameters. The constraint is the product — it forces editorial decisions
about what actually matters in each engine, it makes the instrument learnable in
seconds, and it is what produces the four-bar-chart reading of a patch.

Constraints documented in prose erode. The fifth control always seems reasonable in
isolation.

## Decision

Express it as a tuple type, so the compiler holds the line:

```ts
export type ControlQuad = readonly [ControlSpec, ControlSpec, ControlSpec, ControlSpec];
```

Back it with a property test (`src/core/engines/engines.test.ts`) that walks every
page of every registered engine and asserts four controls, unique ids, defaults in
range, exponential curves with a non-zero minimum, labels that fit under a fader, and
a clean round-trip through the fader's normalised space.

## Consequences

- A fifth control fails the build. Adding one is a deliberate act of deleting the law,
  not an accident.
- Engines must be designed around it. Virtual-analog got WAVE / WIDTH / DETUNE / SUB;
  richer parameters go on additional pages rather than a longer row.
- ADSR happens to be exactly four parameters, which makes the envelope page feel
  discovered rather than imposed.
- New engines inherit the property test for free by registering in `ENGINES`.
