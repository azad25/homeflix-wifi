"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ThumbsUp, MessageSquare, Lightbulb, Bug, Film, CheckCircle2, Star, ExternalLink, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getApiUrl } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Post {
  number: number;
  kind: "feature" | "issue" | "share" | "other";
  title: string;
  body: string;
  url: string;
  author: string;
  avatar: string;
  votes: number;
  comments: number;
  created_at: string;
  closed_at?: string;
}
interface Board { repo: string; open: Post[]; shipped: Post[]; members: number; stars: number; new_issue: string; error?: string }

const TABS = [
  { key: "feature", label: "Feature requests", icon: Lightbulb, template: "feature.yml", cta: "Suggest a feature" },
  { key: "issue", label: "Issues", icon: Bug, template: "bug.yml", cta: "Report an issue" },
  { key: "share", label: "Shared picks", icon: Film, template: "share.yml", cta: "Share a title" },
  { key: "shipped", label: "Shipped", icon: CheckCircle2, template: "", cta: "" },
] as const;

function ago(iso?: string) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 30) return `${Math.floor(d)} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} y ago`;
}

function StatTile({ icon: Icon, label, value, sub }: { icon: any; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/[0.08] md:p-5">
      <div className="flex items-center justify-between text-[13px] text-white/55">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-white/40" />
      </div>
      <div className="mt-2 text-[30px] font-bold leading-none tracking-[-0.02em] text-white tabular-nums">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-white/40">{sub}</div>}
    </div>
  );
}

export default function CommunityPage() {
  usePageTitle("Community");
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("feature");
  const [loading, setLoading] = useState(true);

  const load = async (refresh = false) => {
    setLoading(true);
    try {
      const api = getApiUrl();
      const b = await fetch(`${api}/api/community${refresh ? "?refresh=1" : ""}`).then((r) => r.json()).catch(() => null);
      if (b) setBoard(b);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const posts = useMemo(() => {
    if (!board) return [];
    if (tab === "shipped") return board.shipped;
    return board.open.filter((p) => p.kind === tab || (tab === "issue" && p.kind === "other"));
  }, [board, tab]);
  const current = TABS.find((t) => t.key === tab)!;
  const newURL = board && current.template ? `${board.new_issue}?template=${current.template}` : "";

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-28 md:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[34px] font-bold tracking-[-0.02em] md:text-[44px]">Community</h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-white/55">
              Everyone using HomeFlix shares this board. Vote with 👍 on what should come next; the most wanted features and fixes go into upcoming releases.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-2 self-start rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/15 md:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </header>

        {/* Platform stats */}
        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={Lightbulb} label="Feature requests" value={board ? board.open.filter((p) => p.kind === "feature").length : "—"} sub="Open, ranked by votes" />
          <StatTile icon={CheckCircle2} label="Shipped" value={board?.shipped.length ?? "—"} sub="In the last 60 days" />
          <StatTile icon={MessageSquare} label="Community members" value={board?.members ?? "—"} sub="People who posted" />
          <StatTile icon={Star} label="GitHub stars" value={board?.stars ?? "—"} sub={board?.repo} />
        </section>

        {/* Tabs */}
        <nav className="mt-10 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {TABS.map((t) => {
            const count = !board ? null : t.key === "shipped" ? board.shipped.length : board.open.filter((p) => p.kind === t.key || (t.key === "issue" && p.kind === "other")).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition ${tab === t.key ? "bg-white text-black" : "bg-white/[0.07] text-white/75 hover:bg-white/[0.12] hover:text-white"}`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {count !== null && <span className={tab === t.key ? "text-black/50" : "text-white/40"}>{count}</span>}
              </button>
            );
          })}
          {newURL && (
            <a href={newURL} target="_blank" rel="noreferrer" className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-[14px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/[0.14]">
              {current.cta} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </nav>

        {board?.error && (
          <p className="mt-4 text-[13px] text-white/45">Couldn&apos;t reach GitHub just now ({board.error}); showing the last copy.</p>
        )}

        {/* Posts */}
        <section className="mt-5 flex flex-col gap-3">
          {!board && loading &&
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />)}
          {board && posts.length === 0 && (
            <div className="rounded-2xl bg-white/[0.04] px-6 py-14 text-center text-white/50 ring-1 ring-inset ring-white/[0.07]">
              {tab === "shipped" ? "Nothing shipped in the last 60 days yet." : "Nothing here yet. Be the first to post."}
            </div>
          )}
          {posts.map((p) => (
            <a
              key={p.number}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-4 rounded-2xl bg-white/[0.045] p-4 ring-1 ring-inset ring-white/[0.07] transition hover:bg-white/[0.08] md:p-5"
            >
              <div className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl ${tab === "shipped" ? "bg-success/15 text-success" : "bg-white/[0.08] text-white"}`}>
                {tab === "shipped" ? <CheckCircle2 className="h-5 w-5" /> : <ThumbsUp className="h-4 w-4 opacity-80" />}
                <span className="mt-1 text-[17px] font-bold tabular-nums">{p.votes}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-semibold leading-snug text-white group-hover:underline">{p.title}</h3>
                {p.body && <p className="mt-1 line-clamp-2 text-[14px] text-white/55">{p.body}</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/40">
                  {p.avatar && <img src={p.avatar} alt="" className="h-4 w-4 rounded-full" />}
                  <span>{p.author}</span>
                  <span>#{p.number}</span>
                  <span>{tab === "shipped" ? `shipped ${ago(p.closed_at)}` : ago(p.created_at)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.comments}</span>
                </div>
              </div>
              {tab !== "shipped" && (
                <span className="hidden shrink-0 self-center rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80 group-hover:bg-white group-hover:text-black md:block">
                  Vote 👍
                </span>
              )}
            </a>
          ))}
        </section>
        <p className="mt-6 text-[12px] text-white/35">
          Posting and voting happen on GitHub (a free account is needed). Issues mentioned in a release&apos;s notes move to Shipped automatically.
        </p>
      </main>
    </div>
  );
}
