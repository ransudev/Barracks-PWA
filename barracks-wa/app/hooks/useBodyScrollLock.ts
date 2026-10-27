import { useEffect } from "react";

let bodyScrollLockCount = 0;
let bodyScrollPreviousOverflow = "";

/**
 * Keeps page scrolling disabled while one or more overlays are mounted.
 * A shared counter prevents one overlay from restoring scrolling while another
 * overlay still needs the page locked.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    if (bodyScrollLockCount === 0) {
      bodyScrollPreviousOverflow = document.body.style.overflow;
    }
    bodyScrollLockCount += 1;
    document.body.style.overflow = "hidden";

    let released = false;
    return () => {
      if (released) return;
      released = true;
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = bodyScrollPreviousOverflow;
        bodyScrollPreviousOverflow = "";
      } else {
        document.body.style.overflow = "hidden";
      }
    };
  }, [locked]);
}
