# Contributing

```bash
npm install
npm run dev
npm run verify   # must pass before pushing
```

## Manual verification

Automated tests cover the pure layers. The audio graph and the interface are verified
by driving a real browser — and on a real device, because the simulator lies about
audio.

Run `npm run dev -- --host` and open the printed network address on the device.

### Desktop

1. Press a QWERTY key (A–L) — a note sounds within ~10 ms, no click on attack or release.
2. Move each fader — the sound changes continuously, no zipper noise.
3. Hold more notes than the polyphony allows — the oldest is stolen cleanly, no crack.
4. Toggle light/dark — every surface re-themes; nothing stays hardcoded.
5. Tab to a fader and use arrows, shift+arrows, Home/End — all adjust it.

### Tablet — the reference device, so these are not optional

6. Three fingers on three keys — a chord sounds, and all three release independently.
7. Drag a fader, wander off its track, keep dragging — it still tracks, and the page
   never scrolls or rubber-bands.
8. Long-press a key or pad — no selection menu, no magnifier, no context menu.
9. Rotate portrait ↔ landscape mid-note — layout reflows, audio does not glitch.
10. Add to home screen and launch — no browser chrome, safe areas respected.

### Phone

11. At 390 px — pads, not shrunken piano keys. Every target ≥ 44 px. Nothing clipped.
12. iOS: first tap starts audio. **Then flip the hardware silent switch to silent** and
    confirm it is still audible.
13. Lock the screen and unlock — audio resumes rather than dying silently.
14. Play sustained chords — listen for dropouts. If present, lower polyphony in
    `src/audio/polyphony-budget.ts` rather than shipping crackle.

## Before you push

`npm run verify` runs typecheck, lint, format check, tests and a production build —
the same things CI runs. A push that turns CI red costs a cycle and reviewer trust.
