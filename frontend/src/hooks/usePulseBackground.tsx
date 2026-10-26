import { useEffect, useRef } from 'react';

export type PulseOptions = {
  /** Delay before the very first pulse starts (ms) */
  initialDelay?: number;
  /** Rest period between pulses (ms) */
  interval?: number;
  /** Duration of a single pulse cycle (ms) */
  pulseDuration?: number;
  /** Target highlight color during the peak of the pulse */
  pulseColor?: string;
}

export const usePulseBackground = <T extends HTMLElement = HTMLDivElement>({
  initialDelay = 10000,
  interval = 3000,
  pulseDuration = 1000,
  pulseColor = 'var(--mantine-primary-color-2)',
}: PulseOptions = {}): React.RefObject<T | null> => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timerId: ReturnType<typeof setTimeout>;
    let animation: Animation | null = null;

    const triggerPulse = () => {
      // Reads current background dynamically (works with Mantine light/dark mode)
      const baseColor = getComputedStyle(el).backgroundColor;

      animation = el.animate(
        [
          { backgroundColor: baseColor },
          { backgroundColor: pulseColor },
          { backgroundColor: baseColor },
        ],
        {
          duration: pulseDuration,
          easing: 'ease-in-out',
        }
      );

      // Schedule next pulse only after the current pulse finishes
      animation.onfinish = () => {
        timerId = setTimeout(triggerPulse, interval);
      };
    };

    // Initial delay before the first pulse
    timerId = setTimeout(triggerPulse, initialDelay);

    return () => {
      clearTimeout(timerId);
      animation?.cancel();
    };
  }, [initialDelay, interval, pulseDuration, pulseColor]);

  return ref;
}