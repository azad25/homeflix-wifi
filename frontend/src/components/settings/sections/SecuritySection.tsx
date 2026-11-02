"use client";

import React, { useState } from "react";
import { apiChangePin } from "@/components/PinLock";
import { Button, Field, Group, Notice, SectionHeader, inputClass } from "../ui";

export default function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(current) || !/^\d{4}$/.test(next)) return setMsg({ text: "PINs must be exactly 4 digits.", ok: false });
    if (next !== confirm) return setMsg({ text: "The new PINs don't match.", ok: false });
    setSaving(true);
    const result = await apiChangePin(current, next);
    setSaving(false);
    if (result.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ text: "Your settings PIN was changed.", ok: true });
    } else {
      setMsg({ text: result.error || "Couldn't change the PIN.", ok: false });
    }
  };

  const pin = (label: string, value: string, set: (v: string) => void, auto?: string) => (
    <Field label={label}>
      <input
        type="password"
        inputMode="numeric"
        autoComplete={auto}
        maxLength={4}
        value={value}
        onChange={(e) => {
          set(e.target.value.replace(/\D/g, "").slice(0, 4));
          setMsg(null);
        }}
        placeholder="••••"
        className={`${inputClass} font-mono text-[18px] tracking-[0.4em]`}
      />
    </Field>
  );

  return (
    <div className="space-y-10">
      <SectionHeader title="Security" description="Protect these settings with a PIN." />
      <Group title="Settings PIN" footer="The PIN is stored on the server as a hash and is asked for whenever Settings is opened." padded>
        <form onSubmit={submit} className="max-w-sm space-y-4">
          {pin("Current PIN", current, setCurrent, "current-password")}
          {pin("New PIN", next, setNext, "new-password")}
          {pin("Confirm new PIN", confirm, setConfirm, "new-password")}
          {msg && <Notice tone={msg.ok ? "success" : "danger"}>{msg.text}</Notice>}
          <Button type="submit" variant="primary" loading={saving}>
            Change PIN
          </Button>
        </form>
      </Group>
    </div>
  );
}
