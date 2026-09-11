import { useEffect, useState } from 'react';

/** Breakpoints from docs/architecture.md. The tablet band is the reference design. */
export const BREAKPOINT = {
  phone: 600,
  desktop: 1024,
} as const;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => {
      list.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}

/** True on phones, where piano keys give ~16px per key and become unplayable. */
export const useIsPhone = (): boolean =>
  useMediaQuery(`(max-width: ${BREAKPOINT.phone - 1}px)`);

export const useReducedMotion = (): boolean =>
  useMediaQuery('(prefers-reduced-motion: reduce)');
