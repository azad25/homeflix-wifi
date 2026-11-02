"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Download, Upload, Clock, GitBranch } from "lucide-react";
import { Badge, Button, Group, Notice } from "./ui";
import { useLog } from "./activity";
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
export default function TVAppUpdateCard() {
  const onLog = useLog();
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
    onLog(`${ok ? "📺" : "❌"} TV app: ${text}`);
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
    <Group
      title={
        <span className="flex items-center gap-2.5">
          HomeFlix TV App
          {status && !status.error && <Badge tone={available ? "warning" : "success"}>{available ? "New version" : "Up to date"}</Badge>}
        </span>
      }
      description="Bring the newest TV app build onto this server, or upload an APK. Connected TVs update themselves as soon as a newer build is published."
      footer={status?.dir ? `Builds are stored in ${status.dir}` : undefined}
      padded
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-white/[0.05] p-4">
          <p className="mb-2 text-[12px] font-semibold text-white/45">On this server</p>
          {local ? (
            <>
              <p className="text-[15px] font-medium text-white">
                Version {local.version_name} <span className="text-white/40">({local.version_code})</span>
              </p>
              {local.notes && <p className="mt-1 truncate text-[13px] text-white/60">{local.notes}</p>}
              <p className="mt-1.5 flex items-center gap-1 text-[12px] text-white/45">
                <Clock className="h-3 w-3" />
                {when(local.released_at)} · {mb(local.size)}
              </p>
            </>
          ) : (
            <p className="text-[14px] text-white/55">{status ? "No TV app published yet" : "Loading…"}</p>
          )}
        </div>
        <div className="min-w-0 rounded-xl bg-white/[0.05] p-4">
          <p className="mb-2 text-[12px] font-semibold text-white/45">In the repository</p>
          {remote ? (
            <>
              <p className="text-[15px] font-medium text-white">
                Version {remote.version_name || "unknown"}{" "}
                <span className={available ? "text-[#ffd84d]" : "text-white/40"}>({remote.version_code || "?"})</span>
              </p>
              {remote.commit_message && <p className="mt-1 truncate text-[13px] text-white/60">{remote.commit_message}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-white/45">
                <GitBranch className="h-3 w-3" />
                {remote.repo} · {remote.branch}
                {remote.commit_date ? ` · ${when(remote.commit_date)}` : ""}
                {remote.size ? ` · ${mb(remote.size)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-[14px] text-white/55">{status?.error || "Checking…"}</p>
          )}
        </div>
      </div>

      {message && (
        <div className="mt-4">
          <Notice tone={message.ok ? "success" : "danger"}>{message.text}</Notice>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button variant="primary" icon={<Download />} onClick={fetchLatest} disabled={!!busy || !available} loading={busy === "fetch"}>
          {busy === "fetch" ? "Downloading…" : available && remote ? `Download ${remote.version_name} to Server` : "Download to Server"}
        </Button>
        <Button icon={<RefreshCw className={checking ? "animate-spin" : ""} />} onClick={() => check(true)} disabled={checking || !!busy}>
          {checking ? "Checking…" : "Check Repository"}
        </Button>
        <Button icon={<Upload />} onClick={() => fileRef.current?.click()} disabled={!!busy} loading={busy === "upload"}>
          {busy === "upload" ? "Uploading…" : "Upload APK"}
        </Button>
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
    </Group>
  );
}
