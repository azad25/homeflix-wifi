"use client";

import Navbar from "@/components/Navbar";
import DeveloperCredit from "@/components/about/DeveloperCredit";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1 className="text-4xl font-black tracking-tight">
          Home<span className="text-red-500">Flix</span>
        </h1>
        <p className="mt-2 text-white/60">Your movies and shows, streamed from your own server.</p>
        <div className="mt-10">
          <DeveloperCredit />
        </div>
      </main>
    </div>
  );
}
