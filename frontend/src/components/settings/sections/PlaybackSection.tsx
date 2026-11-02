"use client";

import React from "react";
import { SkipForward, Clapperboard, Gauge } from "lucide-react";
import { setPreference, usePreference } from "@/lib/preferences";
import { Group, Row, SectionHeader, Toggle } from "../ui";

const RATES = [0.75, 1, 1.25, 1.5, 2];

export default function PlaybackSection() {
  const autoplayNext = usePreference("autoplayNext");
  const autoplayPreviews = usePreference("autoplayPreviews");
  const rate = usePreference("playbackRate");

  return (
    <div className="space-y-10">
      <SectionHeader title="Playback" description="How HomeFlix plays on this device. Saved in this browser." />

      <Group title="Autoplay">
        <Row icon={<SkipForward />} title="Autoplay next episode" description="Start the next episode automatically when one ends.">
          <Toggle label="Autoplay next episode" checked={autoplayNext} onChange={(v) => setPreference("autoplayNext", v)} />
        </Row>
        <Row icon={<Clapperboard />} title="Autoplay previews" description="Play trailers and preview clips while browsing.">
          <Toggle label="Autoplay previews" checked={autoplayPreviews} onChange={(v) => setPreference("autoplayPreviews", v)} />
        </Row>
      </Group>

      <Group title="Video" footer="You can still change the speed for a single video from the player.">
        <Row icon={<Gauge />} title="Default playback speed" description="Used when a video starts.">
          <select
            aria-label="Default playback speed"
            value={rate}
            onChange={(e) => setPreference("playbackRate", parseFloat(e.target.value))}
            className="h-9 rounded-lg bg-white/[0.08] px-3 text-[14px] text-white ring-1 ring-inset ring-white/[0.08] focus:outline-none focus:ring-white/40"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r === 1 ? "Normal" : `${r}×`}
              </option>
            ))}
          </select>
        </Row>
      </Group>
    </div>
  );
}
