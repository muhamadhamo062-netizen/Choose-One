"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
}

export function AnimatedNumber({ value }: AnimatedNumberProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(Math.round(safeValue));
  const previous = useRef(safeValue);
  const motionValue = useMotionValue(previous.current);

  useEffect(() => {
    const controls = animate(motionValue, safeValue, {
      duration: 0.4,
      onUpdate(latest) {
        setDisplay(Math.round(latest));
      }
    });
    previous.current = safeValue;

    return () => controls.stop();
  }, [motionValue, safeValue]);

  return <>{display}</>;
}
