import { useEffect, useRef } from "react";

const TRAIL_IDLE_DELAY_MS = 150;
const CURSOR_IDLE_DELAY_MS = 620;
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='button']",
  "[role='link']"
].join(",");

const usesNativeCursor = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));

export function RestFishCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const finePointer = window.matchMedia("(pointer: fine)");
    if (!cursor || !finePointer.matches) return;

    const nearSpark = cursor.querySelector<HTMLElement>(".rest-fish-cursor__spark--near");
    const farSpark = cursor.querySelector<HTMLElement>(".rest-fish-cursor__spark--far");
    const fish = cursor.querySelector<HTMLElement>(".rest-fish-cursor__fish");

    let previousX: number | null = null;
    let previousY: number | null = null;
    let nextX = 0;
    let nextY = 0;
    let animationFrame = 0;
    let trailTimer = 0;
    let idleTimer = 0;

    const renderPosition = () => {
      cursor.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      animationFrame = 0;
    };

    const hideCursor = () => {
      cursor.dataset.visible = "false";
      cursor.dataset.moving = "false";
    };

    const stopTrail = () => {
      cursor.dataset.moving = "false";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if ((event.pointerType && event.pointerType !== "mouse") || usesNativeCursor(event.target)) {
        hideCursor();
        previousX = event.clientX;
        previousY = event.clientY;
        return;
      }

      const deltaX = previousX === null ? 0 : event.clientX - previousX;
      const deltaY = previousY === null ? 0 : event.clientY - previousY;
      const distance = Math.hypot(deltaX, deltaY);
      const directionX = distance > 0.5 ? deltaX / distance : 1;
      const directionY = distance > 0.5 ? deltaY / distance : 0;

      previousX = event.clientX;
      previousY = event.clientY;
      nextX = event.clientX;
      nextY = event.clientY;

      if (nearSpark) {
        nearSpark.style.transform =
          `translate3d(${-directionX * 15 - 3}px, ${-directionY * 15 + 5}px, 0) rotate(45deg)`;
      }
      if (farSpark) {
        farSpark.style.transform =
          `translate3d(${-directionX * 27 - 4}px, ${-directionY * 27 + 8}px, 0) rotate(45deg)`;
      }
      if (fish) {
        const rotation = Math.max(-9, Math.min(9, deltaX * 0.7));
        const direction = deltaX < -0.5 ? -1 : 1;
        fish.style.transform =
          `translate3d(-50%, -50%, 0) rotate(${rotation}deg) scaleX(${direction})`;
      }

      cursor.dataset.visible = "true";
      cursor.dataset.moving = distance > 0.5 ? "true" : "false";

      window.clearTimeout(trailTimer);
      window.clearTimeout(idleTimer);
      trailTimer = window.setTimeout(stopTrail, TRAIL_IDLE_DELAY_MS);
      idleTimer = window.setTimeout(hideCursor, CURSOR_IDLE_DELAY_MS);

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(renderPosition);
      }
    };

    document.documentElement.classList.add("rest-fish-cursor-enabled");
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", hideCursor);
    window.addEventListener("blur", hideCursor);

    return () => {
      document.documentElement.classList.remove("rest-fish-cursor-enabled");
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", hideCursor);
      window.removeEventListener("blur", hideCursor);
      window.clearTimeout(trailTimer);
      window.clearTimeout(idleTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="rest-fish-cursor"
      data-moving="false"
      data-visible="false"
      aria-hidden="true"
    >
      <span className="rest-fish-cursor__spark rest-fish-cursor__spark--far" />
      <span className="rest-fish-cursor__spark rest-fish-cursor__spark--near" />
      <span className="rest-fish-cursor__fish" />
    </div>
  );
}
