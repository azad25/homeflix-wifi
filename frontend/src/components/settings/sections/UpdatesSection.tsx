"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Download, Clock, GitBranch, ArrowUpCircle } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useDialog } from "@/hooks/useDialog";
import { useLog } from "../activity";
import { Badge, Button, Group, Notice, SectionHeader } from "../ui";
import TVAppUpdateCard from "../TVAppUpdateCard";

// Shared by the sidebar badge and this section: one request per minute.
let checkCache: { at: number; promise: Promise<any> } | null = null;
export function fetchUpdateInfo(force = false): Promise<any> {
  if (!force && checkCache && Date.now() - checkCache.at < 60_000) return checkCache.promise;
  const promise = fetch(`${getApiUrl()}/api/admin/update/check`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { ok: false, error: `HTTP ${r.status}` }))
    .catch((e) => ({ ok: false, error: String(e?.message || e) }));
  checkCache = { at: Date.now(), promise };
  return promise;
}

const PHASES: Record<string, string> = {
  starting: "Starting",
  preflight: "Checking repository",
  switch: "Switching release",
  pull: "Pulling changes",
  dependencies: "Installing dependencies",
  "build-backend": "Building server",
  "build-frontend": "Building web app",
  restart: "Restarting",
  rollback: "Rolling back",
};

export default function UpdatesSection() {
  const log = useLog();
  const dialog = useDialog();
  const [info, setInfo] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const check = useCallback(
    async (silent: boolean) => {
      if (!silent) setChecking(true);
      const data = await fetchUpdateInfo(!silent);
      setInfo(data);
      if (!silent) {
        if (!data.ok) log(`❌ Update check: ${data.error}`);
        else if (data.update_available) log(`⬆️ Update available: ${data.behind} commit(s) behind origin/${data.branch}`);
        else log("✅ HomeFlix is up to date");
        if (data.ok && data.upgrade?.branch) log(`🆕 New release available: ${data.upgrade.version} (${data.upgrade.branch})`);
      }
      setChecking(false);
    },
    [log]
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/update/status`, { cache: "no-store" });
      if (!res.ok) return;
      const st = await res.json();
      setStatus(st);
      if (st.state === "done" || st.state === "error") {
        setRunning(false);
        stopPolling();
        log(st.state === "done" ? `✅ ${st.message || "Update complete"} - services restarted` : `❌ Update failed: ${st.message}`);
        if (st.state === "done") check(true);
      }
    } catch {
      // Server is restarting: keep polling until it answers again.
      setStatus((p: any) => ({ ...(p || {}), reconnecting: true }));
    }
  }, [log, check]);

  const startPolling = useCallback(() => {
    stopPolling();
    timer.current = setInterval(poll, 3000);
  }, [poll]);

  useEffect(() => {
    check(true);
    // Re-attach to an update that is still running (page reloaded mid-update).
    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/update/status`, { cache: "no-store" });
        const st = res.ok ? await res.json() : null;
        if (st?.state === "running") {
          setRunning(true);
          setStatus(st);
          startPolling();
        }
      } catch {
        /* server restarting */
      }
    })();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** targetBranch: switch to a newer release branch instead of pulling. */
  const start = async (targetBranch?: string) => {
    if (running || !info?.ok) return;
    if (!targetBranch && !info.update_available) return;
    if (info.dirty) {
      log(`❌ Commit or stash local changes first: ${(info.dirty_files || []).slice(0, 5).join(", ")}`);
      return;
    }
    const ok = await dialog.confirm(
      targetBranch ? `Upgrade to ${info.upgrade?.version || targetBranch}?` : "Install update?",
      targetBranch
        ? `The server switches from ${info.branch} to ${targetBranch}, rebuilds and restarts. If a build fails it rolls back automatically. Your library and media files are never touched.`
        : `Pull ${info.behind} change(s) from ${info.branch}, rebuild and restart. HomeFlix is unavailable for a few minutes. Your library and media files are never touched.`
    );
    if (!ok) return;
    setRunning(true);
    setStatus({ state: "running", phase: "starting", message: "Launching update…" });
    log(targetBranch ? `🚀 Upgrading to ${targetBranch}…` : "🚀 Starting system update…");
    try {
      const qs = targetBranch ? `?branch=${encodeURIComponent(targetBranch)}` : "";
      const res = await fetch(`${getApiUrl()}/api/admin/update/apply${qs}`, { method: "POST" });
      const data = await res.json();
      if (!data.ok && data.already_running) {
        setStatus(data.status || { state: "running", phase: "running", message: "Update in progress…" });
        log("⏳ An update is already in progress - following it");
        startPolling();
        return;
      }
      if (!data.ok) {
        setRunning(false);
        setStatus({ state: "error", message: data.error });
        log(`❌ Update refused: ${data.error}`);
        return;
      }
      startPolling();
    } catch (e) {
      setRunning(false);
      log(`❌ Failed to start update: ${e}`);
    }
  };

  const busy = running || status?.state === "running";
  const badge = !info ? null : !info.ok ? (
    <Badge tone="danger">Unavailable</Badge>
  ) : busy ? (
    <Badge tone="info">Updating…</Badge>
  ) : info.update_available ? (
    <Badge tone="info">{info.behind} new</Badge>
  ) : (
    <Badge tone="success">Up to date</Badge>
  );

  return (
    <div className="space-y-10">
      <SectionHeader title="Software Update" description="Keep the HomeFlix server and the HomeFlix TV app up to date." />

      <Group
        title={<span className="flex items-center gap-2.5">HomeFlix Server {badge}</span>}
        description="Pulls the latest code, rebuilds the server and web app and restarts. Your library, database and media are never touched."
        padded
      >
        <div className="grid gap-4 md:grid-cols-2">
          <VersionTile label="Installed" commit={info?.ok ? info.current : null} branch={info?.ok ? info.branch : null} fallback={info && !info.ok ? info.error : "Checking…"} />
          <VersionTile
            label="Available"
            commit={info?.ok && info.behind > 0 ? info.remote : null}
            branch={info?.ok && info.behind > 0 ? `${info.behind} new change${info.behind > 1 ? "s" : ""}` : null}
            fallback={info?.ok ? "You have the latest version" : "—"}
            highlight={!!info?.update_available}
          />
        </div>

        {info?.ok && info.dirty && (
          <div className="mt-4">
            <Notice tone="warning" title={`Local changes block updates (${(info.dirty_files || []).length} file(s))`}>
              Commit or stash them on the server first: <span className="font-mono">{(info.dirty_files || []).slice(0, 4).join(" · ")}</span>
            </Notice>
          </div>
        )}

        {info?.ok && info.upgrade?.branch && (
          <div className="mt-4">
            <Notice
              tone="info"
              title={`New release: HomeFlix ${info.upgrade.version}`}
              action={
                <Button variant="primary" icon={<ArrowUpCircle />} onClick={() => start(info.upgrade.branch)} disabled={busy || info.dirty}>
                  Upgrade to {info.upgrade.version}
                </Button>
              }
            >
              {info.upgrade.remote?.subject && <span className="block truncate">{info.upgrade.remote.subject}</span>}
              You&apos;re on {info.branch}. Upgrading switches to {info.upgrade.branch} and rolls back automatically if a build fails.
            </Notice>
          </div>
        )}

        {status && (busy || status.state === "done" || status.state === "error") && (
          <UpdateProgress status={status} />
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button
            variant="primary"
            icon={<Download />}
            onClick={() => start()}
            disabled={busy || !(info?.ok && info.update_available && !info.dirty)}
            loading={busy}
          >
            {busy ? "Updating…" : info?.ok && info.behind > 0 ? `Update Now (${info.behind})` : "Update Now"}
          </Button>
          <Button icon={<RefreshCw className={checking ? "animate-spin" : ""} />} onClick={() => check(false)} disabled={checking || busy}>
            {checking ? "Checking…" : "Check for Updates"}
          </Button>
        </div>
        {info?.fetch_error && (
          <p className="mt-3 text-[12px] text-white/40">Couldn&apos;t reach GitHub ({String(info.fetch_error).slice(0, 80)}) - showing the last known state.</p>
        )}
      </Group>

      <TVAppUpdateCard />
    </div>
  );
}

function VersionTile({
  label,
  commit,
  branch,
  fallback,
  highlight,
}: {
  label: string;
  commit: any;
  branch: string | null;
  fallback: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.05] p-4">
      <p className="mb-2 text-[12px] font-semibold text-white/45">{label}</p>
      {commit ? (
        <>
          <p className="truncate text-[15px] font-medium text-white">{commit.subject || commit.short}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/45">
            <span className="font-mono">{commit.short}</span>
            {branch && (
              <span className={`flex items-center gap-1 ${highlight ? "text-info" : ""}`}>
                <GitBranch className="h-3 w-3" />
                {branch}
              </span>
            )}
            {commit.date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {commit.date}
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="text-[14px] text-white/55">{fallback}</p>
      )}
    </div>
  );
}

function UpdateProgress({ status }: { status: any }) {
  const order = Object.keys(PHASES);
  const idx = Math.max(0, order.indexOf(status.phase));
  const done = status.state === "done";
  const failed = status.state === "error";
  const pct = done ? 100 : failed ? 100 : Math.round(((idx + 1) / (order.length - 1)) * 90);
  return (
    <div className="mt-4 rounded-xl bg-black/30 p-4 ring-1 ring-inset ring-white/[0.06]">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-white">
          {done ? "Update complete" : failed ? "Update failed" : PHASES[status.phase] || "Working"}
        </span>
        {status.reconnecting && !done && <span className="text-info">Server restarting - reconnecting…</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${failed ? "bg-danger" : done ? "bg-success" : "bg-white"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] text-white/60">{status.message || "Working…"}</p>
      {done && (
        <Button size="sm" variant="primary" className="mt-3" onClick={() => window.location.reload()}>
          Reload HomeFlix
        </Button>
      )}
    </div>
  );
}
