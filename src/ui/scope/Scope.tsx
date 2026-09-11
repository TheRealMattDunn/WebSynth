import { useEffect, useRef } from 'react';
import { engine } from '@/ui/hooks/useAudio';
import { useIsPhone, useReducedMotion } from '@/ui/hooks/useMediaQuery';

/**
 * Oscilloscope.
 *
 * The one moving thing in an otherwise still interface, which is why it is a
 * hairline rather than a filled shape. Drawn straight to canvas from a
 * requestAnimationFrame loop reading the AnalyserNode — deliberately never
 * through React state, because pushing audio-rate data through a render cycle
 * sixty times a second is how a UI like this starts dropping frames.
 */
export function Scope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPhone = useIsPhone();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Phones have far less GPU and thermal headroom, and a scope is decoration
    // next to keeping the audio thread fed.
    const minFrameMs = isPhone ? 1000 / 30 : 1000 / 60;

    let frame = 0;
    let lastDraw = 0;
    let buffer = new Float32Array(2048);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastDraw < minFrameMs) return;
      lastDraw = now;

      const analyser = engine.getAnalyser();
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);

      const styles = getComputedStyle(canvas);
      const stroke = styles.getPropertyValue('--ink-faint').trim() || '#888';
      const mid = height / 2;

      context.lineWidth = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      context.strokeStyle = stroke;
      context.beginPath();

      if (!analyser) {
        // Flat line when there is no audio yet, rather than an empty box.
        context.moveTo(0, mid);
        context.lineTo(width, mid);
      } else {
        if (buffer.length !== analyser.fftSize)
          buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);
        const step = buffer.length / width;
        for (let x = 0; x < width; x++) {
          const sample = buffer[Math.floor(x * step)] ?? 0;
          const y = mid - sample * mid * 0.9;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
      }
      context.stroke();
    };

    resize();
    // Nothing to animate if the tab is hidden, and browsers throttle rAF anyway.
    if (!reducedMotion) frame = requestAnimationFrame(draw);
    else draw(0);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isPhone, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
