"use client";

import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { BackendWidgetRenderer, WidgetManagementButton } from "@/components/widgets";
import { useParams } from "next/navigation";

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>() || { slug: "" };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <ErrorBoundary>
        <BackendWidgetRenderer page={slug} className="py-8 mt-12 px-3 md:px-6 lg:px-8" />
      </ErrorBoundary>
      <WidgetManagementButton page={slug} showPerformance={true} />
    </div>
  );
}
