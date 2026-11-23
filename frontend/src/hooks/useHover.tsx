import { useState, useCallback, useRef } from 'react';

//we're writing our own useHover here so we can expose a way to force false without a mouseleave event

export const useHover = <T extends HTMLElement = any>() => {
  const [hovered, setHovered] = useState(false);
  const previousNode = useRef<T | null>(null);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const ref: React.RefCallback<T | null> = useCallback(
    (node: T | null) => {
      if (previousNode.current) {
        previousNode.current.removeEventListener('mouseenter', handleMouseEnter);
        previousNode.current.removeEventListener('mouseleave', handleMouseLeave);
      }

      if (node) {
        node.addEventListener('mouseenter', handleMouseEnter);
        node.addEventListener('mouseleave', handleMouseLeave);
      }

      previousNode.current = node;
    },
    [handleMouseEnter, handleMouseLeave]
  );

  return { ref, hovered, setHovered };
}