"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FolderPlus, Folder, Trash2, RefreshCw, Search, HardDrive } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getApiUrl } from "@/lib/api";
import { useDialog } from "@/hooks/useDialog";
import { useLog } from "../activity";
import CloudStorage from "./CloudStorage";
import PreviewStorage from "./PreviewStorage";
import { Badge, Button, EmptyState, Field, Group, SectionHeader, Toggle, inputClass } from "../ui";

interface MediaPath {
  id: number;
  path: string;
  name: string;
  description?: string;
  path_type: string;
  priority: number;
  is_active: boolean;
}

interface StorageInfo {
  path: string;
  name?: string;
  total: number;
  used: number;
  free: number;
  used_percent: number;
  is_low: boolean;
}

const GB = 1024 ** 3;
const TYPE_LABEL: Record<string, string> = { primary: "Primary", torrent: "Downloads", external: "External drive", cloud: "Cloud" };
const EMPTY = { path: "", name: "", description: "", path_type: "external", priority: 0 };

export default function StorageSection() {
  const log = useLog();
  const dialog = useDialog();
  const [paths, setPaths] = useState<MediaPath[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    const api = getApiUrl();
    const [p, s] = await Promise.all([
      fetch(`${api}/api/admin/media-paths`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${api}/api/admin/storage/stats`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setPaths(p?.media_paths || []);
    setStorage(s?.storages || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (url: string, init: RequestInit, failMsg: string) => {
    try {
      const res = await fetch(`${getApiUrl()}${url}`, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        log(`❌ ${failMsg}: ${data.error || res.statusText}`);
        return false;
      }
      log(`✅ ${data.message || "Saved"}`);
      return true;
    } catch (e) {
      log(`❌ ${failMsg}: ${e}`);
      return false;
    }
  };

  const add = async () => {
    if (!draft.path.trim() || !draft.name.trim()) {
      log("❌ A folder path and a name are required");
      return;
    }
    setSaving(true);
    if (await call("/api/admin/media-paths", { method: "POST", body: JSON.stringify(draft) }, "Couldn't add the folder")) {
      setDraft(EMPTY);
      setAdding(false);
      load();
    }
    setSaving(false);
  };

  const update = async (p: MediaPath, changes: Partial<MediaPath>) => {
    setPaths((list) => list?.map((x) => (x.id === p.id ? { ...x, ...changes } : x)) || null); // optimistic
    if (!(await call(`/api/admin/media-paths/${p.id}`, { method: "PUT", body: JSON.stringify(changes) }, "Couldn't update the folder"))) load();
  };

  const remove = async (p: MediaPath) => {
    if (!(await dialog.confirm("Remove this folder?", `HomeFlix stops scanning "${p.name}". Files on disk are not deleted.`, true))) return;
    if (await call(`/api/admin/media-paths/${p.id}`, { method: "DELETE" }, "Couldn't remove the folder")) load();
  };

  const scanAll = async () => {
    setScanning(true);
    log("🚀 Full scan started…");
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/scan/full`, { method: "POST" });
      log(res.ok ? "✅ Full scan finished" : `❌ Scan failed: ${res.statusText}`);
    } catch (e) {
      log(`❌ Scan failed: ${e}`);
    }
    setScanning(false);
  };

  const totals = storage.reduce((a, s) => ({ total: a.total + s.total, free: a.free + s.free }), { total: 0, free: 0 });

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Storage"
        description="Folders HomeFlix scans for movies and shows. Downloads are written straight to the drive with the most room; if a drive fills up mid-download it moves to another one."
        actions={
          <>
            <Button size="sm" icon={<Search />} onClick={scanAll} loading={scanning}>
              Scan All
            </Button>
            <Button size="sm" variant="primary" icon={<FolderPlus />} onClick={() => setAdding((a) => !a)}>
              Add Folder
            </Button>
          </>
        }
      />

      {storage.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.045] p-4 ring-1 ring-inset ring-white/[0.07] md:p-5">
            <p className="text-[13px] text-white/50">Free space</p>
            <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.02em] text-white">{(totals.free / GB).toFixed(0)} GB</p>
            <p className="mt-2 text-[12px] text-white/40">of {(totals.total / GB).toFixed(0)} GB across {storage.length} drive{storage.length > 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.045] p-4 ring-1 ring-inset ring-white/[0.07] md:p-5">
            <p className="text-[13px] text-white/50">Folders</p>
            <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.02em] text-white">{paths?.length ?? "—"}</p>
            <p className="mt-2 text-[12px] text-white/40">{paths?.filter((p) => p.is_active).length ?? 0} active</p>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Group title="Add a Folder" padded>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Folder path">
                  <input className={inputClass} value={draft.path} onChange={(e) => setDraft({ ...draft, path: e.target.value })} placeholder="/mnt/media/movies" autoFocus />
                </Field>
                <Field label="Name">
                  <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Movies drive" />
                </Field>
                <Field label="Type">
                  <select className={inputClass} value={draft.path_type} onChange={(e) => setDraft({ ...draft, path_type: e.target.value })}>
                    <option value="primary">Primary</option>
                    <option value="torrent">Downloads</option>
                    <option value="external">External drive</option>
                  </select>
                </Field>
                <Field label="Priority" hint="Higher numbers are preferred for new downloads.">
                  <input type="number" className={inputClass} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value) || 0 })} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description (optional)">
                    <input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </Field>
                </div>
              </div>
              <div className="mt-5 flex gap-2.5">
                <Button variant="primary" onClick={add} loading={saving}>
                  Add Folder
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </Group>
          </motion.div>
        )}
      </AnimatePresence>

      <Group
        title="Media Folders"
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={load}>
            Refresh
          </Button>
        }
        footer="Turning a folder off hides it from scans without removing anything. Primary and Downloads folders receive new downloads; cloud drives are filled only by moving titles."
      >
        {paths === null ? (
          <EmptyState title="Loading…" />
        ) : paths.length === 0 ? (
          <EmptyState
            icon={<Folder />}
            title="No folders yet"
            description="Add the folders where your movies and shows live."
            action={
              <Button variant="primary" icon={<FolderPlus />} onClick={() => setAdding(true)}>
                Add Folder
              </Button>
            }
          />
        ) : (
          paths.map((p) => {
            const info = storage.find((s) => s.path === p.path);
            return (
              <div key={p.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white/80">
                  <HardDrive className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[15px] font-semibold ${p.is_active ? "text-white" : "text-white/45"}`}>{p.name}</span>
                    <Badge>{TYPE_LABEL[p.path_type] || p.path_type}</Badge>
                    {p.priority > 0 && <Badge>Priority {p.priority}</Badge>}
                    {info?.is_low && <Badge tone="danger">Low space</Badge>}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[12px] text-white/45">{p.path}</p>
                  {p.description && <p className="mt-0.5 text-[13px] text-white/55">{p.description}</p>}
                  {info && (
                    <div className="mt-2 max-w-md">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${info.is_low ? "bg-[#ff453a]" : info.used_percent > 80 ? "bg-[#ffd60a]" : "bg-white/70"}`}
                          style={{ width: `${Math.min(100, info.used_percent)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[12px] text-white/45">
                        {(info.free / GB).toFixed(1)} GB free of {(info.total / GB).toFixed(1)} GB
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-end md:self-center">
                  <Toggle label={`${p.name} active`} checked={p.is_active} onChange={(v) => update(p, { is_active: v })} />
                  <Button size="sm" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => remove(p)} icon={<Trash2 />} />
                </div>
              </div>
            );
          })
        )}
      </Group>

      <PreviewStorage />

      <CloudStorage />
    </div>
  );
}
