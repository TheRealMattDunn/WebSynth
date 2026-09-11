import { asHertz, asMilliseconds, asPercent } from '@/core/controls/scaling';
import { quad, type ControlPage, type ControlSpec } from '@/core/controls/types';

/**
 * Pages shared by every sound engine.
 *
 * ADSR being exactly four parameters is the happy accident that makes the
 * Four-Control Law feel discovered rather than imposed.
 */

const seconds = (id: string, label: string, def: number, max: number): ControlSpec => ({
  id,
  label,
  min: 0.001,
  max,
  default: def,
  curve: 'exp',
  format: asMilliseconds,
});

export const ENVELOPE_PAGE: ControlPage = {
  id: 'env',
  label: 'Envelope',
  controls: quad(
    seconds('attack', 'ATK', 0.005, 4),
    seconds('decay', 'DEC', 0.25, 4),
    {
      id: 'sustain',
      label: 'SUS',
      min: 0,
      max: 1,
      default: 0.7,
      curve: 'lin',
      format: asPercent,
    },
    seconds('release', 'REL', 0.3, 8),
  ),
};

export const FILTER_PAGE: ControlPage = {
  id: 'filter',
  label: 'Filter',
  controls: quad(
    {
      id: 'cutoff',
      label: 'CUTOFF',
      min: 20,
      max: 18000,
      default: 3000,
      curve: 'exp',
      format: asHertz,
    },
    {
      id: 'resonance',
      label: 'RESO',
      min: 0,
      max: 1,
      default: 0.15,
      curve: 'lin',
      format: asPercent,
    },
    {
      id: 'drive',
      label: 'DRIVE',
      min: 0,
      max: 1,
      default: 0.1,
      curve: 'lin',
      format: asPercent,
    },
    {
      id: 'level',
      label: 'LEVEL',
      min: 0,
      max: 1,
      default: 0.8,
      curve: 'lin',
      format: asPercent,
    },
  ),
};
