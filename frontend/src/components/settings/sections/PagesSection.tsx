"use client";

import React from "react";
import PageManager from "../PageManager";
import { Group, SectionHeader } from "../ui";

export default function PagesSection() {
  return (
    <div className="space-y-10">
      <SectionHeader title="Pages" description="Build custom browse pages from widgets and choose what appears in the menu." />
      <Group padded>
        <PageManager />
      </Group>
    </div>
  );
}
