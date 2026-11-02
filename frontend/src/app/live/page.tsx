"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Search, Tv } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getApiUrl } from "@/lib/api";
import LivePlayer, { LiveChannel } from "@/components/live/LivePlayer";

interface Facet {
  code: string;
  count: number;
}

const flag = (cc: string) =>
  cc.length === 2 && cc !== "ZZ" ? String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "📺";

let regionNames: Intl.DisplayNames | null = null;
const countryName = (cc: string) => {
  if (cc === "ZZ") return "My Channels";
  try {
    regionNames = regionNames || new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(cc) || cc;
  } catch {
    return cc;
  }
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const LS_LAST = "homeflix_live_last";
const LS_FAVS = "homeflix_live_favs";
const readLS = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLS = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export default function LiveTVPage() {
  usePageTitle("Live TV");
  const [all, setAll] = useState<LiveChannel[] | null>(null);
  const [countries, setCountries] = useState<Facet[]>([]);
  const [categories, setCategories] = useState<Facet[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [country, setCountry] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [current, setCurrent] = useState<LiveChannel | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setFavs(JSON.parse(readLS(LS_FAVS) || "[]"));
    } catch {
      /* ignore */
    }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/livetv/channels`);
        const d = await res.json();
        if (!alive) return;
        setEnabled(d.enabled !== false);
        setSyncing(!!d.syncing);
        setAll(d.channels || []);
        setCountries(d.countries || []);
        setCategories(d.categories || []);
        if (d.syncing && !(d.channels || []).length) setTimeout(load, 5000); // first sync in progress
      } catch {
        if (alive) setAll([]);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  // Resume the last channel, like a TV does.
  useEffect(() => {
    if (!all || current) return;
    const last = readLS(LS_LAST);
    const ch = all.find((c) => c.id === last) || null;
    if (ch) setCurrent(ch);
  }, [all, current]);

  const visible = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all.filter(
      (c) =>
        (!country || (country === "FAV" ? favs.includes(c.id) : c.country === country)) &&
        (!category || (c.categories || []).includes(category)) &&
        (!q || c.name.toLowerCase().includes(q))
    );
  }, [all, country, category, query, favs]);

  const tune = useCallback((ch: LiveChannel | null) => {
    if (!ch) return;
    setCurrent(ch);
    writeLS(LS_LAST, ch.id);
  }, []);

  const toggleFav = (id: string) => {
    setFavs((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      writeLS(LS_FAVS, JSON.stringify(next));
      return next;
    });
  };

  // Keep the playing channel in view in the guide.
  useEffect(() => {
    if (!current) return;
    listRef.current?.querySelector(`[data-ch="${CSS.escape(current.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const chip = (active: boolean) =>
    `tv-focus flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active ? "bg-white text-black" : "bg-white/[0.08] text-white/75 hover:bg-white/[0.14] hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="tv-gutter pb-20 pt-20 md:pt-24">
        <h1 className="mb-4 text-[34px] font-bold tracking-[-0.03em] md:text-5xl">Live TV</h1>
        {/* Filters */}
        <div className="mb-5 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button type="button" className={chip(country === "")} onClick={() => setCountry("")}>
              All channels <span className="opacity-60">{all?.length ?? ""}</span>
            </button>
            <button type="button" className={chip(country === "FAV")} onClick={() => setCountry("FAV")}>
              <Heart className="h-3.5 w-3.5" /> Favorites
            </button>
            {countries.map((c) => (
              <button key={c.code} type="button" className={chip(country === c.code)} onClick={() => setCountry(c.code)}>
                {flag(c.code)} {countryName(c.code)} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              <button type="button" className={chip(category === "")} onClick={() => setCategory("")}>
                All categories
              </button>
              {categories.slice(0, 18).map((c) => (
                <button key={c.code} type="button" className={chip(category === c.code)} onClick={() => setCategory(c.code)}>
                  {cap(c.code)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <LivePlayer
              channel={current}
              channels={visible.length ? visible : all || []}
              onTune={tune}
              favorites={favs}
              onToggleFavorite={toggleFav}
            />
            <p className="mt-3 hidden text-[12px] text-white/40 md:block">
              Double-click or F for full screen · ▲▼ or PgUp/PgDn change channel · type a number · Enter opens the guide · Backspace returns to the last channel · +/− volume · M mute
            </p>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search channels"
                className="h-11 w-full rounded-full bg-white/[0.08] pl-10 pr-4 text-[15px] text-white placeholder:text-white/40 focus:bg-white/[0.12] focus:outline-none"
              />
            </div>
            <div ref={listRef} className="mt-3 max-h-[56vh] overflow-y-auto rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] xl:max-h-[calc(100vh-14rem)]">
              {all === null ? (
                <div className="space-y-px p-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="px-6 py-14 text-center text-[14px] text-white/50">
                  {!enabled
                    ? "Live TV is turned off in Settings."
                    : syncing
                      ? "Getting the channel list for the first time…"
                      : country === "FAV"
                        ? "No favorites yet. Add channels with the heart button."
                        : "No channels match."}
                </div>
              ) : (
                visible.map((c) => {
                  const active = current?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      data-ch={c.id}
                      type="button"
                      onClick={() => tune(c)}
                      className={`tv-focus flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? "bg-white text-black" : "hover:bg-white/[0.06]"}`}
                    >
                      <span className={`w-9 shrink-0 text-right font-mono text-[13px] tabular-nums ${active ? "text-black/60" : "text-white/40"}`}>{c.number}</span>
                      <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/90">
                        {c.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logo} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                        ) : (
                          <Tv className="h-4 w-4 text-black/50" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                        <span className={`block truncate text-[12px] ${active ? "text-black/55" : "text-white/45"}`}>
                          {flag(c.country)} {countryName(c.country)}
                          {c.categories?.[0] ? ` · ${cap(c.categories[0])}` : ""}
                          {c.quality ? ` · ${c.quality}` : ""}
                        </span>
                      </span>
                      {favs.includes(c.id) && <Heart className="h-3.5 w-3.5 shrink-0 fill-current text-[#ff453a]" />}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>

      </main>
    </div>
  );
}
