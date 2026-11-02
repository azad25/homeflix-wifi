"use client";

import React from "react";
import SystemLogs from "@/components/SystemLogs";
import { useLog } from "../activity";
import { SectionHeader } from "../ui";

export default function ServerSection() {
  const log = useLog();
  return (
    <div className="space-y-8">
      <SectionHeader title="Server" description="Live resource usage, services, logs and a command console." />
      <SystemLogs onTerminalOutput={log} showStorage={false} />
    </div>
  );
}
