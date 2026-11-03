"use client";

import Navbar from "@/components/Navbar";
import BrandLogo from "@/components/brand/BrandLogo";
import DeveloperCredit from "@/components/about/DeveloperCredit";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1>
          <BrandLogo size="lg" />
        </h1>
        <p className="mt-2 text-white/60">Your movies and shows, streamed from your own server.</p>
        <div className="mt-10">
          <DeveloperCredit />
        </div>
      </main>
    </div>
  );
}
