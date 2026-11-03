"use client";

import React from "react";
import DeveloperCredit from "@/components/about/DeveloperCredit";
import { SectionHeader } from "../ui";
import UsageSharing from "./UsageSharing";

export default function AboutSection() {
  return (
    <div className="max-w-3xl space-y-8">
      <SectionHeader title="About HomeFlix" description="Developer, contact and open source." />
      <UsageSharing />
      <DeveloperCredit />
    </div>
  );
}
