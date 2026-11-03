"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * HomeFlix opening ident (~3s), shown before a title starts, in the spirit of
 * a studio logo but in the app's own black & white language:
 *   light streak sweeps the dark -> a projector aperture opens -> the play
 *   mark is drawn and lights up -> the wordmark resolves letter by letter
 *   while a shine passes over it.
 * Pure CSS/SVG + framer-motion: no video file, scales to any screen.
 */
export const BRAND_INTRO_MS = 3200;

const WORD = ["H", "o", "m", "e", "F", "l", "i", "x"];
const PLAY = "M24 17.6v28.8c0 2.4 2.6 3.9 4.7 2.7l24-14.4c2-1.2 2-4.1 0-5.3l-24-14.4c-2.1-1.3-4.7.2-4.7 2.6Z";
const ease = [0.22, 1, 0.36, 1] as const;

export default function BrandIntro() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Vignette depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.07)_0%,rgba(0,0,0,0)_45%,rgba(0,0,0,1)_80%)]" />

      {/* 1. Horizontal light streak (anamorphic flare) */}
      <motion.div
        className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9) 50%, transparent)" }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1.2], opacity: [0, 1, 0] }}
        transition={{ duration: 1.3, times: [0, 0.45, 1], ease: "easeOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-24 w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
        initial={{ opacity: 0, scaleY: 0.2 }}
        animate={{ opacity: [0, 0.8, 0.15], scaleY: [0.2, 1, 0.6] }}
        transition={{ duration: 1.6, times: [0, 0.4, 1], ease: "easeOut" }}
      />

      {/* 2. Projector aperture: rings opening outward */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 3.2 + i], opacity: [0, 0.5, 0] }}
          transition={{ duration: 1.8, delay: 0.45 + i * 0.18, ease: "easeOut" }}
        />
      ))}

      {/* Drifting light particles */}
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const r = 160 + (i % 3) * 60;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-white"
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.6, opacity: [0, 0.8, 0] }}
            transition={{ duration: 2.2, delay: 0.6 + (i % 5) * 0.05, ease: "easeOut" }}
          />
        );
      })}

      {/* Centre lock-up */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* 3. Play mark: drawn, then lit */}
        <motion.div
          className="relative"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 1.06, 1], opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.55, ease }}
        >
          <motion.div
            className="absolute inset-[-40%] rounded-full bg-white blur-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0.12] }}
            transition={{ duration: 1.4, delay: 1.1 }}
          />
          <svg viewBox="0 0 64 64" className="relative h-20 w-20 md:h-28 md:w-28" aria-hidden>
            <motion.path
              d={PLAY}
              fill="none"
              stroke="white"
              strokeWidth={1.6}
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeInOut" }}
            />
            <motion.path
              d={PLAY}
              fill="white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 1.35 }}
            />
          </svg>
        </motion.div>

        {/* 4. Wordmark: letters resolve, tracking tightens, a shine passes */}
        <motion.div
          className="relative mt-6 overflow-hidden text-[44px] leading-none text-white md:mt-8 md:text-[72px]"
          initial={{ letterSpacing: "0.35em" }}
          animate={{ letterSpacing: "-0.04em" }}
          transition={{ duration: 1.5, delay: 1.25, ease }}
        >
          {WORD.map((ch, i) => (
            <motion.span
              key={i}
              className={i < 4 ? "inline-block font-extrabold" : "inline-block font-light text-white/80"}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6, delay: 1.3 + i * 0.06, ease }}
            >
              {ch}
            </motion.span>
          ))}
          <motion.span
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
            initial={{ left: "-40%" }}
            animate={{ left: "120%" }}
            transition={{ duration: 0.9, delay: 2.1, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Underline sweep */}
        <motion.div
          className="mt-5 h-px w-40 bg-gradient-to-r from-transparent via-white/70 to-transparent md:w-64"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: [0, 1, 0.4] }}
          transition={{ duration: 1, delay: 1.9, ease }}
        />
      </div>
    </div>
  );
}
