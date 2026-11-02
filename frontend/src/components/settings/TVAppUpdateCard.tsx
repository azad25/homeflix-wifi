"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Tv, RefreshCw, Download, Upload, Clock, GitBranch } from "lucide-react";
import { GlassCard, MagneticButton } from "@/components/scrollx";
import { getApiUrl } from "@/lib/api";

interface Release {
  version_code: number;
  version_name: string;
  size: number;
  notes?: string;
  released_at: string;
}

interface Remote {
  repo: string;
  branch: string;
  commit?: string;
  commit_message?: string;
  commit_date?: string;
  apk_path: string;
  size?: number;
  version_code: number;
  version_name: string;
}

interface SourceStatus {
  local: Release | null;
  remote?: Remote;
  update_available?: boolean;
  error?: string;
  dir: string;
  repo: string;
}

const mb = (n?: number) => (n ? `${(n / 1024 / 1024).toFixed(1)} MB` : "");
const when = (d?: string) => (d ? new Date(d).toLocaleString() : "");

/**
 * Settings card for the HomeFlix TV app: pull the newest APK from the TV app
 * repository into backend/app-updates/tv, or upload one by hand. Publishing
 * a newer build tells every connected TV to update itself.
 */
export default function TVAppUpdateCard({ onLog }: { onLog?: (line: string) => void }) {
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<null | "fetch" | "upload">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const check = useCallback(async (refresh: boolean) => {
    setChecking(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/app/tv/source${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      setStatus(await res.json());
    } catch {
      setStatus((s) => (s ? { ...s, error: "Couldn't reach the HomeFlix server" } : null));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check(false);
  }, [check]);

  const report = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    onLog?.(`${ok ? "📺" : "❌"} TV app: ${text}`);
  };

  const fetchLatest = async () => {
    setBusy("fetch");
    setMessage(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/app/tv/fetch`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) report(false, data?.error || `Download failed (${res.status})`);
      else report(true, data?.message || "Done");
    } catch {
      report(false, "Couldn't reach the HomeFlix server");
    } finally {
      setBusy(null);
      check(false);
    }
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setMessage(null);
    try {
      const form = new FormData();
      form.append("apk", file);
      const res = await fetch(`${getApiUrl()}/api/admin/app/tv/upload`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) report(false, data?.error || `Upload failed (${res.status})`);
      else report(true, `Published TV app ${data?.version_name} (${data?.version_code}) - connected TVs were told to update`);
    } catch {
      report(false, "Upload failed - couldn't reach the HomeFlix server");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
      check(false);
    }
  };

  const local = status?.local;
  const remote = status?.remote;
  const available = !!status?.update_available;

  return (
    <GlassCard className="p-6">
      <h2 className="mb-2 flex items-center text-2xl font-semibold text-white">
        <Tv className="mr-3 h-6 w-6 text-white/70" />
        HomeFlix TV App
        {status && !status.error && (
          <span
            className={`ml-4 rounded-full px-3 py-1 text-xs font-medium ${
              available ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
            }`}
          >
            {available ? "New version" : "Up to date"}
          </span>
        )}
      </h2>
      <p className="mb-6 text-sm text-white/60">
        Bring the newest TV app build onto this server from the TV app repository, or upload an APK. Connected TVs are
        told to update as soon as a newer build is published.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">On this server</p>
          {local ? (
            <>
              <p className="font-mono text-sm text-white">
                {local.version_name} <span className="text-white/40">({local.version_code})</span>
              </p>
              {local.notes && <p className="mt-1 truncate text-xs text-white/60">{local.notes}</p>}
              <p className="mt-1 flex items-center text-xs text-white/40">
                <Clock className="mr-1 h-3 w-3" />
                {when(local.released_at)} · {mb(local.size)}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/50">{status ? "No TV app published yet" : "Loading…"}</p>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">In the repository</p>
          {remote ? (
            <>
              <p className="font-mono text-sm text-white">
                {remote.version_name || "unknown"}{" "}
                <span className={available ? "text-yellow-400" : "text-white/40"}>({remote.version_code || "?"})</span>
              </p>
              {remote.commit_message && <p className="mt-1 truncate text-xs text-white/60">{remote.commit_message}</p>}
              <p className="mt-1 flex items-center text-xs text-white/40">
                <GitBranch className="mr-1 h-3 w-3" />
                {remote.repo} · {remote.branch}
                {remote.commit_date ? ` · ${when(remote.commit_date)}` : ""}
                {remote.size ? ` · ${mb(remote.size)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/50">{status?.error || "Checking…"}</p>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-lg border p-3 text-sm ${
            message.ok ? "border-green-500/20 bg-green-500/10 text-green-300" : "border-red-500/20 bg-red-500/10 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <MagneticButton
          onClick={() => check(true)}
          disabled={checking || !!busy}
          className="flex items-center space-x-2 rounded-lg bg-white/10 px-5 py-2 text-white hover:bg-white/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          <span>{checking ? "Checking…" : "Check Repository"}</span>
        </MagneticButton>
        <MagneticButton
          onClick={fetchLatest}
          disabled={!!busy || !available}
          className="flex items-center space-x-2 rounded-lg bg-white px-5 py-2 font-semibold text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40"
        >
          <Download className={`h-4 w-4 ${busy === "fetch" ? "animate-bounce" : ""}`} />
          <span>
            {busy === "fetch"
              ? "Downloading…"
              : available && remote
                ? `Download ${remote.version_name} to Server`
                : "Download to Server"}
          </span>
        </MagneticButton>
        <MagneticButton
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="flex items-center space-x-2 rounded-lg bg-white/10 px-5 py-2 text-white hover:bg-white/20 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          <span>{busy === "upload" ? "Uploading…" : "Upload APK"}</span>
        </MagneticButton>
        <input
          ref={fileRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>
      {status?.dir && <p className="mt-3 text-xs text-white/40">Builds are stored in {status.dir}</p>}
    </GlassCard>
  );
}
