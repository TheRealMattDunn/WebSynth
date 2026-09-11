# 0002 — Bundle worklets with esbuild rather than Vite's `?worker&url`

**Status:** accepted · M0

## Context

`AudioWorkletGlobalScope` has no module loader in Safari, so worklet code must arrive
as one self-contained file with nothing left to resolve. Since the tablet — and
therefore iPad Safari — is this project's reference device, this is not a corner case.

Vite's built-in `?worker&url` was measured first:

|                         | Production build              | Dev server                                                           |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `?worker&url`           | Self-contained IIFE. Correct. | ES module with live imports, including Vite's own client env import. |
| `worker.format: 'iife'` | Correct.                      | No effect — still live imports.                                      |

So the built-in works in production everywhere, and in dev only in browsers that
support `import` inside a worklet. That means `npm run dev` would work on a laptop and
fail on the iPad it is meant to be tested on, which is the worst possible split.

## Decision

`plugins/vite-plugin-audio-worklet.ts`. A `*.worklet.ts?audio-worklet` import is
bundled by esbuild into a self-contained IIFE and its URL returned:

- **dev** — bundled on demand behind a `/@audio-worklet/` middleware, with inline
  sourcemaps, so DSP stays debuggable
- **build** — emitted as a hashed asset

esbuild is given the `@` alias explicitly, since it runs outside Vite's resolver.

## Consequences

- Dev and production behave identically, which is the point.
- One extra dev dependency (esbuild) and ~90 lines of plugin. Vite 8 ships Rolldown
  rather than esbuild, so it is a real addition rather than a transitive one.
- Worklets are bundled per request in dev. esbuild is fast enough at this size that no
  cache is needed, which removes a whole class of staleness bug.
- Editing a worklet or shared DSP triggers a full page reload: a worklet is only read
  at `addModule()` time, so hot-patching it would achieve nothing.
