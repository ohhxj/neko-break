import { useEffect, useRef } from "react";

const IDLE_DELAY_MS = 110;
const DIRECTION_THRESHOLD_PX = 0.8;
const nativeCursorSelector = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']"
].join(",");

const usesNativeCursor = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(nativeCursorSelector));

export function WalkingCatCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const finePointer = window.matchMedia("(pointer: fine)");
    if (!cursor || !finePointer.matches) return;

    let previousX: number | null = null;
    let idleTimer = 0;
    let animationFrame = 0;
    let nextX = 0;
    let nextY = 0;

    const renderPosition = () => {
      cursor.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      animationFrame = 0;
    };

    const hideCursor = () => {
      cursor.dataset.visible = "false";
      cursor.dataset.moving = "false";
    };

    const stopWalking = () => {
      cursor.dataset.moving = "false";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") {
        hideCursor();
        return;
      }

      if (usesNativeCursor(event.target)) {
        cursor.dataset.visible = "false";
        previousX = event.clientX;
        return;
      }

      const deltaX = previousX === null ? 0 : event.clientX - previousX;
      previousX = event.clientX;
      nextX = event.clientX;
      nextY = event.clientY;

      if (deltaX < -DIRECTION_THRESHOLD_PX) {
        cursor.dataset.direction = "left";
      } else if (deltaX > DIRECTION_THRESHOLD_PX) {
        cursor.dataset.direction = "right";
      }

      cursor.dataset.visible = "true";
      cursor.dataset.moving = "true";
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(stopWalking, IDLE_DELAY_MS);

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(renderPosition);
      }
    };

    const handlePointerDown = () => {
      cursor.dataset.pressed = "true";
    };

    const handlePointerUp = () => {
      cursor.dataset.pressed = "false";
    };

    document.documentElement.classList.add("walking-cat-cursor-enabled");
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", hideCursor);
    window.addEventListener("blur", hideCursor);

    return () => {
      document.documentElement.classList.remove("walking-cat-cursor-enabled");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      document.documentElement.removeEventListener("mouseleave", hideCursor);
      window.removeEventListener("blur", hideCursor);
      window.clearTimeout(idleTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="walking-cat-cursor"
      data-direction="right"
      data-moving="false"
      data-pressed="false"
      data-visible="false"
      aria-hidden="true"
    >
      <span className="walking-cat-cursor__sprite" />
    </div>
  );
}
