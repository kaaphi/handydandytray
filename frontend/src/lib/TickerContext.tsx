import React, { createContext, useEffect, useState } from 'react';

export const TickerContext = createContext<number>(0);

interface TickerProviderProps {
  children: React.ReactNode;
  intervalMs?: number;
}

export function TickerProvider({ children, intervalMs = 30000 }: TickerProviderProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return (
    <TickerContext.Provider value={tick}>
      {children}
    </TickerContext.Provider>
  );
}
