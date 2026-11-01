import { redirect } from "next/navigation";

// The old /tv-series list duplicated /tv-shows (and crashed on load: its
// parallax sections used framer-motion scroll refs before hydration).
// Series details still live at /tv-series/[id].
export default function TVSeriesIndex() {
  redirect("/tv-shows");
}
