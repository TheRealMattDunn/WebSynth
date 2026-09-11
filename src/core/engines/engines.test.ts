import { describe, expect, it } from 'vitest';
import { fromNormalised, toNormalised } from '@/core/controls/scaling';
import { allControls, defaultPatch } from '@/core/patch';
import { ENGINES } from './index';

/**
 * These tests exist to hold the design law rather than to check arithmetic.
 * If someone adds a fifth fader to a page in two years' time, this is what stops them.
 */
describe.each(ENGINES.map((e) => [e.id, e] as const))('engine %s', (_id, engine) => {
  it('exposes exactly four controls on every page', () => {
    for (const page of engine.pages) {
      expect(page.controls, `page "${page.id}" breaks the Four-Control Law`).toHaveLength(
        4,
      );
    }
  });

  it('has a unique id for every control', () => {
    const ids = allControls(engine.id).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique page ids', () => {
    const ids = engine.pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allControls(engine.id).map((c) => [c.id, c] as const))(
    'control %s is internally consistent',
    (_controlId, control) => {
      expect(control.min).toBeLessThan(control.max);
      expect(control.default).toBeGreaterThanOrEqual(control.min);
      expect(control.default).toBeLessThanOrEqual(control.max);

      // An exponential curve divides by min and takes its log, so a min of zero
      // silently yields -Infinity and a dead fader.
      if (control.curve === 'exp') expect(control.min).toBeGreaterThan(0);
      if (control.curve === 'stepped')
        expect(control.steps ?? 0).toBeGreaterThanOrEqual(2);

      // Labels sit under a fader roughly six characters wide.
      expect(control.label.length).toBeLessThanOrEqual(6);
      expect(control.label).toBe(control.label.toUpperCase());

      // Every control must survive a trip through the fader and back unchanged,
      // or moving a fader would nudge values that were never touched.
      const round = fromNormalised(control, toNormalised(control, control.default));
      expect(round).toBeCloseTo(control.default, 6);

      // And it must produce a finite, formattable value across its whole travel.
      for (const t of [0, 0.33, 0.5, 0.67, 1]) {
        const value = fromNormalised(control, t);
        expect(Number.isFinite(value)).toBe(true);
        expect(control.format(value)).toBeTruthy();
      }
    },
  );

  it('produces a default patch covering every control', () => {
    const patch = defaultPatch(engine.id);
    expect(patch.engine).toBe(engine.id);
    expect(patch.schemaVersion).toBe(1);
    for (const control of allControls(engine.id)) {
      expect(patch.values[control.id]).toBe(control.default);
    }
    expect(Object.keys(patch.values)).toHaveLength(allControls(engine.id).length);
  });
});

describe('engine registry', () => {
  it('has at least one engine and unique ids', () => {
    expect(ENGINES.length).toBeGreaterThan(0);
    const ids = ENGINES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
