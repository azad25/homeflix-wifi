"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface Track {
  id: number;
  language: string;
  title?: string;
  codec_name?: string;
  channels?: number;
  track_type?: string;
  is_default?: boolean;
  is_forced?: boolean;
  is_hearing_impaired?: boolean;
}

const LANGS: Record<string, string> = {
  en: "English", eng: "English", es: "Spanish", spa: "Spanish", fr: "French", fre: "French", fra: "French",
  de: "German", ger: "German", deu: "German", it: "Italian", ita: "Italian", pt: "Portuguese", por: "Portuguese",
  ru: "Russian", rus: "Russian", ja: "Japanese", jpn: "Japanese", ko: "Korean", kor: "Korean", zh: "Chinese",
  chi: "Chinese", zho: "Chinese", ar: "Arabic", ara: "Arabic", hi: "Hindi", hin: "Hindi", bn: "Bengali", ben: "Bengali",
  nl: "Dutch", dut: "Dutch", nld: "Dutch", pl: "Polish", pol: "Polish", tr: "Turkish", tur: "Turkish",
  sv: "Swedish", swe: "Swedish", da: "Danish", dan: "Danish", fi: "Finnish", fin: "Finnish", no: "Norwegian",
  nor: "Norwegian", cs: "Czech", cze: "Czech", ces: "Czech", el: "Greek", gre: "Greek", ell: "Greek",
  he: "Hebrew", heb: "Hebrew", th: "Thai", tha: "Thai", vi: "Vietnamese", vie: "Vietnamese", id: "Indonesian",
  ind: "Indonesian", ms: "Malay", may: "Malay", hu: "Hungarian", hun: "Hungarian", ro: "Romanian", rum: "Romanian",
  uk: "Ukrainian", ukr: "Ukrainian", fa: "Persian", per: "Persian", ur: "Urdu", urd: "Urdu", ta: "Tamil", tam: "Tamil",
  te: "Telugu", tel: "Telugu", und: "Unknown",
};

const languageName = (code?: string) => {
  if (!code) return "Unknown";
  const c = code.toLowerCase();
  return LANGS[c] || code.charAt(0).toUpperCase() + code.slice(1);
};

const audioLabel = (t: Track) => {
  const parts = [languageName(t.language)];
  const extra = [t.title && !/^(track|audio|stereo|surround)\s*\d*$/i.test(t.title) ? t.title : null,
    t.channels && t.channels >= 6 ? "5.1" : null, t.is_default ? "Original" : null].filter(Boolean);
  return extra.length ? `${parts[0]} [${extra.join(", ")}]` : parts[0];
};

const subtitleLabel = (t: Track) => {
  const flags = [t.is_hearing_impaired ? "CC" : null, t.is_forced ? "Forced" : null].filter(Boolean);
  return flags.length ? `${languageName(t.language)} (${flags.join(", ")})` : languageName(t.language);
};

interface AudioSubtitlesPanelProps {
  open: boolean;
  onClose: () => void;
  mediaId: number;
  currentAudio: number | null;
  currentSubtitle: number | null;
  subtitlesOn: boolean;
  onSelectAudio: (id: number) => void;
  onSelectSubtitle: (id: number | null) => void;
}

/** Netflix-style Audio | Subtitles panel anchored to the right edge. */
export default function AudioSubtitlesPanel({
  open,
  onClose,
  mediaId,
  currentAudio,
  currentSubtitle,
  subtitlesOn,
  onSelectAudio,
  onSelectSubtitle,
}: AudioSubtitlesPanelProps) {
  const [audio, setAudio] = useState<Track[]>([]);
  const [subs, setSubs] = useState<Track[]>([]);
  const [loaded, setLoaded] = useState<number | null>(null);

  useEffect(() => {
    if (!open || loaded === mediaId) return;
    let cancelled = false;
    const base = getApiUrl();
    Promise.all([
      fetch(`${base}/api/media/${mediaId}/audio`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${base}/api/media/${mediaId}/subtitles`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([a, s]) => {
      if (cancelled) return;
      setAudio(Array.isArray(a) ? a : []);
      setSubs(Array.isArray(s) ? s : []);
      setLoaded(mediaId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mediaId, loaded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const selectedAudio = currentAudio ?? audio.find((a) => a.is_default)?.id ?? audio[0]?.id ?? null;
  const selectedSub = subtitlesOn ? currentSubtitle : null;

  const Row = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <li>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg py-2.5 pl-1 pr-3 text-left text-[17px] transition-colors md:text-[19px] ${
          active ? "text-white" : "text-white/55 hover:text-white"
        }`}
      >
        <span className="flex w-6 shrink-0 justify-center">{active && <Check className="h-5 w-5" />}</span>
        <span className="truncate">{label}</span>
      </button>
    </li>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="tracks-backdrop"
            className="absolute inset-0 z-[55]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="tracks-panel"
            role="dialog"
            aria-label="Audio and subtitles"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-24 right-0 top-20 z-[56] flex w-[min(760px,100%)] rounded-l-2xl bg-[#262626]/95 text-white shadow-2xl backdrop-blur-xl md:bottom-28"
          >
            <section className="flex min-w-0 flex-1 flex-col border-r border-white/10 px-6 py-6 md:px-10">
              <h3 className="mb-3 text-[22px] font-bold md:text-[26px]">Audio</h3>
              <ul className="-mr-4 flex-1 overflow-y-auto pr-4 [scrollbar-width:thin]" role="menu">
                {audio.length === 0 && <Row active label="Default" onClick={() => undefined} />}
                {audio.map((t) => (
                  <Row key={t.id} active={t.id === selectedAudio} label={audioLabel(t)} onClick={() => onSelectAudio(t.id)} />
                ))}
              </ul>
            </section>
            <section className="flex min-w-0 flex-1 flex-col px-6 py-6 md:px-10">
              <h3 className="mb-3 text-[22px] font-bold md:text-[26px]">Subtitles</h3>
              <ul className="-mr-4 flex-1 overflow-y-auto pr-4 [scrollbar-width:thin]" role="menu">
                <Row active={selectedSub === null} label="Off" onClick={() => onSelectSubtitle(null)} />
                {subs.length > 0 && <li aria-hidden="true" className="my-2 ml-10 h-px bg-white/10" />}
                {subs.map((t) => (
                  <Row key={t.id} active={t.id === selectedSub} label={subtitleLabel(t)} onClick={() => onSelectSubtitle(t.id)} />
                ))}
              </ul>
            </section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
