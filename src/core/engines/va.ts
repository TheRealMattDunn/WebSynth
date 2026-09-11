import { asCents, asOneOf, asPercent } from '@/core/controls/scaling';
import { quad } from '@/core/controls/types';
import { ENVELOPE_PAGE, FILTER_PAGE } from './pages';
import type { EngineDef } from './types';

export const WAVE_NAMES = ['SAW', 'PULSE'] as const;

/**
 * Virtual-analog: two anti-aliased oscillators and a sub, through a resonant
 * state-variable filter.
 *
 * The bread-and-butter sound, and the one that proves the DSP is real — a naive
 * saw is four lines of code and sounds like a fax machine above the fifth octave.
 * See src/audio/dsp/polyblep.ts.
 */
export const VA_ENGINE: EngineDef = {
  id: 'va',
  name: 'ANALOG',
  blurb: 'Two anti-aliased oscillators, a sub, and a resonant filter.',
  pages: [
    {
      id: 'va',
      label: 'Analog',
      controls: quad(
        {
          id: 'wave',
          label: 'WAVE',
          min: 0,
          max: 1,
          default: 0,
          curve: 'stepped',
          steps: 2,
          format: asOneOf(WAVE_NAMES),
        },
        {
          id: 'width',
          label: 'WIDTH',
          min: 0.05,
          max: 0.95,
          default: 0.5,
          curve: 'lin',
          format: asPercent,
        },
        {
          id: 'detune',
          label: 'DETUNE',
          min: 0,
          max: 40,
          default: 8,
          curve: 'lin',
          format: asCents,
        },
        {
          id: 'sub',
          label: 'SUB',
          min: 0,
          max: 1,
          default: 0.25,
          curve: 'lin',
          format: asPercent,
        },
      ),
    },
    ENVELOPE_PAGE,
    FILTER_PAGE,
  ],
};
