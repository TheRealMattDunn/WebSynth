# 0004 — Maximum TypeScript strictness from the first commit

**Status:** accepted · M0

## Context

"Vibe coded, but not wild west." Strictness is nearly free on day one and miserable to
retrofit once there are thousands of lines to fix.

## Decision

Beyond `strict: true`:

- `noUncheckedIndexedAccess` — array access yields `T | undefined`. In DSP code full of
  buffer indexing this is the difference between a typed `undefined` and a silent `NaN`
  propagating through the audio graph.
- `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `noUnusedLocals`, `noUnusedParameters`
- `erasableSyntaxOnly` — no enums, no constructor parameter properties. Types erase to
  nothing, so the emitted code is plain JavaScript with no TypeScript-only runtime
  semantics.
- `verbatimModuleSyntax`, `isolatedModules`

Plus `typescript-eslint` with type-aware rules (`recommendedTypeChecked` and
`stylisticTypeChecked`), and Prettier.

## Consequences

- More `?? 0` and explicit guards in hot loops than strictly necessary. Accepted: a
  comparison costs nothing next to an audio dropout.
- `erasableSyntaxOnly` rejected the constructor parameter properties and `const enum`
  the DSP code initially used. Both were replaced with plain fields and an `as const`
  object, which is what worklet code should look like anyway.
- Lint is type-aware, so config and plugin files must be covered by a tsconfig. They
  are, via `tsconfig.node.json`.
