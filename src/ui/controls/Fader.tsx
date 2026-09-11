import { useCallback, useId, useRef, useState } from 'react';
import { fromNormalised, toNormalised } from '@/core/controls/scaling';
import type { ControlSpec } from '@/core/controls/types';
import styles from './Fader.module.css';

interface FaderProps {
  spec: ControlSpec;
  value: number;
  onChange: (value: number) => void;
  /** Called once when a drag starts, so the engine can be woken by the gesture. */
  onGesture?: () => void;
}

/** Fraction of the track height a full-range drag covers. */
const DRAG_RANGE_PX = 180;
/** Arrow keys move this much of the range; shift makes it finer. */
const KEY_STEP = 0.02;
const KEY_STEP_FINE = 0.005;

/**
 * The control the whole instrument is built from.
 *
 * A vertical fader rather than a rotary knob, for two reasons: four of them read
 * as a bar chart, so a patch is legible at a glance, and a linear drag is a
 * gesture people can actually perform accurately on glass — a knob needs a
 * circular motion nobody does well with a thumb.
 *
 * Pointer Events throughout with explicit capture, so a drag that wanders off
 * the track keeps working, several faders can be moved at once on a touchscreen,
 * and the page never scrolls underneath the gesture.
 */
export function Fader({ spec, value, onChange, onGesture }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startNorm: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const normalised = toNormalised(spec, value);
  const labelId = useId();

  const commit = useCallback(
    (norm: number) => {
      onChange(fromNormalised(spec, Math.min(1, Math.max(0, norm))));
    },
    [onChange, spec],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Ignore secondary buttons but allow any touch or pen contact.
      if (event.button !== 0) return;
      onGesture?.();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startNorm: toNormalised(spec, value),
      };
      setDragging(true);
    },
    [onGesture, spec, value],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) return;

      const range = trackRef.current?.clientHeight ?? DRAG_RANGE_PX;
      // Up is more. Shift gives a quarter-speed fine adjust.
      const delta = (drag.startY - event.clientY) / Math.max(range, 40);
      commit(drag.startNorm + delta * (event.shiftKey ? 0.25 : 1));
    },
    [commit],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? KEY_STEP_FINE : KEY_STEP;
      const current = toNormalised(spec, value);
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          commit(current + step);
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          commit(current - step);
          break;
        case 'PageUp':
          commit(current + step * 5);
          break;
        case 'PageDown':
          commit(current - step * 5);
          break;
        case 'Home':
          commit(0);
          break;
        case 'End':
          commit(1);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [commit, spec, value],
  );

  /** Double-click or double-tap returns the control to its default. */
  const onDoubleClick = useCallback(() => {
    onChange(spec.default);
  }, [onChange, spec.default]);

  const percent = `${(normalised * 100).toFixed(2)}%`;

  return (
    <div className={styles.fader}>
      <div className={styles.readout}>{spec.format(value)}</div>
      <div
        ref={trackRef}
        className={`${styles.track} t4-interactive`}
        data-active={dragging}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        aria-valuetext={spec.format(value)}
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
      >
        <div className={styles.fill} style={{ height: percent }} />
        <div className={styles.edge} style={{ bottom: percent }} />
      </div>
      <div className={styles.label} id={labelId}>
        {spec.label}
      </div>
    </div>
  );
}
