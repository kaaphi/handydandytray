import { useContext } from "react";
import { TickerContext } from "../lib/TickerContext";

// Custom hook to subscribe components to the central tick
export const useTick = () => useContext(TickerContext);