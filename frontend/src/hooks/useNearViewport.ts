"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True once the element is within `rootMargin` of the viewport (sticky).
 *
 * Used instead of native `loading="lazy"` for artwork in grids/shelves:
 * Chrome's lazy loader can miss images inside transformed, aspect-ratio
 * cards (the first check sees an unsettled box) and then not re-check until
 * something in that card changes layout - e.g. hovering it. An explicit
 * IntersectionObserver re-evaluates on every scroll/resize.
 */
export function useNearViewport<T extends Element>(eager = false, rootMargin = "800px 0px") {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, rootMargin]);

  return [ref, near] as const;
}
