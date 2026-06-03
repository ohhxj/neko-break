import { useEffect, useState } from "react";

export function useBreakOverlay(initialSeconds: number, active = true, resetKey = 0) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  useEffect(() => {
    setRemainingSeconds(initialSeconds);
  }, [initialSeconds, resetKey]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active]);

  return remainingSeconds;
}
