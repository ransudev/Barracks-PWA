"use client";

import { useEffect, useState } from "react";

/**
 * Exit duration in milliseconds. Keep in sync with the `--drawer-duration`
 * value in `app/globals.css`, which drives the matching transition.
 */
const EXIT_DURATION_MS = 240;

export type DrawerPhase = "entering" | "entered" | "exiting";

type DrawerPresence = { mounted: boolean; phase: DrawerPhase };

/**
 * Keeps a closing drawer mounted until its exit transition finishes. The
 * returned `phase` is applied as `data-state` on the drawer layer, which the
 * shared drawer styles in `globals.css` animate from, so the inventory drawer
 * and the operational DetailDrawer move the same way.
 *
 * State only moves inside frame and timeout callbacks, so opening or closing a
 * drawer never cascades a render straight back into another render.
 */
export function useDrawerPresence(open: boolean): DrawerPresence {
  const [presence, setPresence] = useState<DrawerPresence>({ mounted: open, phase: open ? "entered" : "exiting" });

  useEffect(() => {
    if (open) {
      // Mount in the closed position first, then flip to the open position on the
      // next frame so the browser has a start value to transition from.
      let settle = 0;
      const mount = window.requestAnimationFrame(() => {
        setPresence((current) => (current.mounted ? current : { mounted: true, phase: "entering" }));
        settle = window.requestAnimationFrame(() => setPresence({ mounted: true, phase: "entered" }));
      });
      return () => {
        window.cancelAnimationFrame(mount);
        window.cancelAnimationFrame(settle);
      };
    }

    const start = window.setTimeout(() => setPresence({ mounted: true, phase: "exiting" }), 0);
    const finish = window.setTimeout(() => setPresence({ mounted: false, phase: "exiting" }), EXIT_DURATION_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(finish);
    };
  }, [open]);

  return presence;
}
