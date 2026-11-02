"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Cloud, CloudUpload, Plus, Trash2, Terminal, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useDialog } from "@/hooks/useDialog";
import { useLog } from "../activity";
import { Badge, Button, Dot, EmptyState, Field, Group, Notice, Row, Toggle, inputClass } from "../ui";

interface TypeInfo {
  label: string;
  oauth: boolean;
  fields: string[];
}
interface Mount {
  remote: string;
  folder: string;
  mount_point: string;
  cache_gb: number;
  enabled: boolean;
  status?: string;
  error?: string;
}
interface Info {
  installed: boolean;
  version?: string;
  fuse: boolean;
  remotes: { name: string; type: string }[];
  settings: { mounts: Mount[] | null; offload_when_low: boolean; offload_target: string; offload_idle_days: number };
  types: Record<string, TypeInfo>;
  error?: string;
}

const FIELD_LABEL: Record<string, string> = {
  token: "Token (from rclone authorize)",
  drive_id: "Drive ID (optional)",
  drive_type: "Drive type (personal / business)",
  provider: "Provider (AWS, Wasabi, Cloudflare, Minio…)",
  access_key_id: "Access key ID",
  secret_access_key: "Secret access key",
  region: "Region (optional)",
  endpoint: "Endpoint (optional)",
  account: "Account ID",
  key: "Application key",
  url: "Server URL",
  vendor: "Vendor (nextcloud, owncloud, other)",
  user: "Username",
  pass: "Password",
  host: "Host",
  port: "Port (optional)",
};
const SECRET = new Set(["token", "secret_access_key", "key", "pass"]);

// Tolerate missing / null fields from older servers or rclone errors.
function normalize(d: any): Info {
  return {
    installed: !!d?.installed,
    version: d?.version,
    fuse: !!d?.fuse,
    remotes: Array.isArray(d?.remotes) ? d.remotes : [],
    settings: {
      mounts: Array.isArray(d?.settings?.mounts) ? d.settings.mounts : [],
      offload_when_low: !!d?.settings?.offload_when_low,
      offload_target: d?.settings?.offload_target || "",
      offload_idle_days: d?.settings?.offload_idle_days || 30,
    },
    types: d?.types || {},
    error: d?.error,
  };
}

export default function CloudStorage() {
  const log = useLog();
  const dialog = useDialog();
  const [info, setInfo] = useState<Info | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; type: string; params: Record<string, string> }>({ name: "", type: "drive", params: {} });
  const [mountForm, setMountForm] = useState<{ remote: string; folder: string; cache_gb: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/cloud`, { cache: "no-store" });
      setInfo(normalize(await r.json()));
    } catch {
      /* server unreachable */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  // Follow mounts that are starting.
  useEffect(() => {
    if (!info?.settings.mounts?.some((m) => m.status === "starting")) return;
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [info, load]);

  const call = async (path: string, method: string, body?: unknown, ok?: string) => {
    setBusy(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/cloud${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.statusText);
      if (d.installed !== undefined) setInfo(normalize(d));
      else load();
      if (ok) log(`✅ ${ok}`);
      return true;
    } catch (e) {
      log(`❌ ${e instanceof Error ? e.message : e}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!info) return null;
  const mounts = info.settings.mounts || [];
  const type = info.types?.[form.type];

  return (
    <div className="space-y-10">
      <Group
        title="Cloud Storage"
        description="Use Google Drive, OneDrive, Dropbox, S3, Backblaze, WebDAV and more as extra storage. Cloud drives are added to your library and can take titles when local drives get full."
        actions={
          info.installed ? (
            <Button size="sm" icon={<Plus />} onClick={() => setAdding((a) => !a)}>
              Add Cloud Drive
            </Button>
          ) : undefined
        }
      >
        {!info.installed ? (
          <div className="p-5">
            <Notice tone="info" title="Install rclone on the server to use cloud drives">
              HomeFlix uses rclone to connect to cloud services. On the server run{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-white">sudo apt install rclone fuse3</code> (or see rclone.org/install),
              then restart HomeFlix.
            </Notice>
          </div>
        ) : (
          <>
            {info.error && (
              <div className="p-4 md:px-5">
                <Notice tone="warning" title="rclone reported a problem">
                  <span className="font-mono text-[12px]">{info.error}</span>
                </Notice>
              </div>
            )}
            <Row
              icon={<Terminal />}
              title={info.version || "rclone"}
              description={info.fuse ? "Ready to mount cloud drives." : "FUSE isn't available: install fuse3 on the server to mount cloud drives."}
            >
              {info.fuse ? <Badge tone="success">Ready</Badge> : <Badge tone="warning">Needs fuse3</Badge>}
            </Row>
            {info.remotes.length === 0 && !adding && (
              <EmptyState icon={<Cloud />} title="No cloud drives yet" description="Add one to use it as storage." />
            )}
            {info.remotes.map((r) => {
              const m = mounts.find((x) => x.remote === r.name);
              const tone = m?.status === "mounted" ? "success" : m?.status === "error" ? "danger" : m?.status === "starting" ? "info" : "neutral";
              return (
                <div key={r.name} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white/80">
                    <Cloud className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-white">
                      {r.name} <Badge>{info.types?.[r.type]?.label || r.type}</Badge>
                    </p>
                    {m ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/50">
                        <Dot tone={tone} />
                        {m.status === "mounted" ? "Mounted" : m.status === "starting" ? "Connecting…" : m.status === "error" ? "Not mounted" : m.enabled ? "Waiting" : "Off"}
                        {" · "}
                        {r.name}:{m.folder || "/"} → <span className="font-mono">{m.mount_point}</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12px] text-white/45">Not used for storage yet</p>
                    )}
                    {m?.error && <p className="mt-1 text-[12px] text-[#ff7b73]">{m.error}</p>}
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {m ? (
                      <>
                        <Toggle label={`Mount ${r.name}`} checked={m.enabled} onChange={(v) => call(`/mounts/${r.name}`, "PATCH", { enabled: v })} />
                        <Button size="sm" variant="ghost" onClick={async () => (await dialog.confirm("Stop using this drive?", "It's unmounted and no longer scanned. Nothing is deleted from the cloud.")) && call(`/mounts/${r.name}`, "DELETE", undefined, `${r.name} unmounted`)}>
                          Unmount
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="primary" icon={<CloudUpload />} onClick={() => setMountForm({ remote: r.name, folder: "HomeFlix", cache_gb: 20 })}>
                        Use for Storage
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${r.name}`}
                      icon={<Trash2 />}
                      onClick={async () => (await dialog.confirm(`Remove ${r.name}?`, "HomeFlix forgets this connection. Files in the cloud are not deleted.", true)) && call(`/remotes/${r.name}`, "DELETE", undefined, `${r.name} removed`)}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Group>

      {mountForm && (
        <Group title={`Use ${mountForm.remote} for Storage`} padded>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Folder on the cloud drive" hint="Created if it doesn't exist. Leave empty to use the whole drive.">
              <input className={inputClass} value={mountForm.folder} onChange={(e) => setMountForm({ ...mountForm, folder: e.target.value })} />
            </Field>
            <Field label="Local cache (GB)" hint="Recently played parts are kept locally for smooth playback and seeking.">
              <input type="number" min={1} className={inputClass} value={mountForm.cache_gb} onChange={(e) => setMountForm({ ...mountForm, cache_gb: +e.target.value })} />
            </Field>
          </div>
          <div className="mt-5 flex gap-2.5">
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => (await call("/mounts", "POST", mountForm, `${mountForm.remote} is being mounted`)) && setMountForm(null)}
            >
              Mount
            </Button>
            <Button variant="ghost" onClick={() => setMountForm(null)}>
              Cancel
            </Button>
          </div>
        </Group>
      )}

      {adding && info.installed && (
        <Group title="Add a Cloud Drive" padded>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Service">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, params: {} })}>
                {Object.entries(info.types || {}).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" hint="Letters, numbers, - and _ (e.g. gdrive)">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} placeholder={form.type} />
            </Field>
            {type?.oauth && (
              <div className="md:col-span-2">
                <Notice tone="info" title="Sign in on a computer with a web browser">
                  Run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-white">rclone authorize &quot;{form.type}&quot;</code>, sign in, then paste the
                  token it prints (the part in curly braces) below.
                </Notice>
              </div>
            )}
            {type?.fields.map((f) => (
              <div key={f} className={f === "token" ? "md:col-span-2" : ""}>
                <Field label={FIELD_LABEL[f] || f}>
                  {f === "token" ? (
                    <textarea
                      rows={3}
                      className={`${inputClass} h-auto py-2.5 font-mono text-[12px]`}
                      value={form.params[f] || ""}
                      onChange={(e) => setForm({ ...form, params: { ...form.params, [f]: e.target.value } })}
                      placeholder='{"access_token":"…","token_type":"Bearer",…}'
                    />
                  ) : (
                    <input
                      type={SECRET.has(f) ? "password" : "text"}
                      autoComplete="off"
                      className={inputClass}
                      value={form.params[f] || ""}
                      onChange={(e) => setForm({ ...form, params: { ...form.params, [f]: e.target.value } })}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2.5">
            <Button
              variant="primary"
              loading={busy}
              disabled={!form.name}
              onClick={async () => {
                if (await call("/remotes", "POST", form, `${form.name} connected`)) {
                  setAdding(false);
                  setMountForm({ remote: form.name, folder: "HomeFlix", cache_gb: 20 });
                  setForm({ name: "", type: "drive", params: {} });
                }
              }}
            >
              Connect
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </Group>
      )}

      {info.installed && mounts.length > 0 && (
        <Group title="When Local Drives Get Full" footer="Titles keep playing from the cloud; recently played parts are cached locally.">
          <Row icon={<CloudUpload />} title="Move titles to the cloud" description={`Moves titles nobody watched for ${info.settings.offload_idle_days || 30} days off drives that are running low.`}>
            <Toggle
              label="Move titles to the cloud"
              checked={info.settings.offload_when_low}
              onChange={(v) =>
                call("/settings", "PUT", {
                  offload_when_low: v,
                  offload_target: info.settings.offload_target || mounts[0].remote,
                  offload_idle_days: info.settings.offload_idle_days || 30,
                })
              }
            />
          </Row>
          {info.settings.offload_when_low && (
            <>
              <Row icon={<Cloud />} title="Cloud drive">
                <select
                  aria-label="Cloud drive for moved titles"
                  value={info.settings.offload_target}
                  onChange={(e) => call("/settings", "PUT", { ...info.settings, offload_target: e.target.value })}
                  className="h-9 rounded-lg bg-white/[0.08] px-3 text-[14px] text-white"
                >
                  {mounts.map((m) => (
                    <option key={m.remote} value={m.remote}>
                      {m.remote}
                    </option>
                  ))}
                </select>
              </Row>
              <Row icon={<AlertTriangle />} title="Only titles not watched for">
                <select
                  aria-label="Idle days"
                  value={info.settings.offload_idle_days}
                  onChange={(e) => call("/settings", "PUT", { ...info.settings, offload_idle_days: +e.target.value })}
                  className="h-9 rounded-lg bg-white/[0.08] px-3 text-[14px] text-white"
                >
                  {[7, 14, 30, 60, 90, 180].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </Row>
              <Row icon={busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} title="Run now" description="Normally checked every hour.">
                <Button size="sm" onClick={() => call("/offload", "POST", undefined, "Checked local drives")}>
                  Run Now
                </Button>
              </Row>
            </>
          )}
        </Group>
      )}
    </div>
  );
}
