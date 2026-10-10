"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Volume2,
  VolumeX,
  Star,
  Calendar,
  Info,
  Sparkles,
  ChevronRight,
  Flame,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { getApiUrl } from "@/lib/api";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const TMDB_GENRES: { [key: number]: string } = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

interface Movie {
  id: number;
  title: string;
  overview: string;
  backdrop_path: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface Video {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

interface MovieWithVideo extends Movie {
  videoKey?: string;
  logoUrl?: string;
}

const TRAILER_TAGS = ["Featured", "Action", "Drama", "New arrivals", "Top picks"];

const extractYouTubeKey = (url?: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

export default function TrailersPage() {
  const [movies, setMovies] = useState<MovieWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [ytReady, setYtReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const router = useRouter();
  const playerRef = useRef<any>(null);

  const activeMovie = movies[activeIndex] ?? movies[0];

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existingScript) {
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setYtReady(true);
          clearInterval(checkReady);
        }
      }, 100);

      setTimeout(() => clearInterval(checkReady), 10000);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  useEffect(() => {
    fetchUpcomingMovies();
  }, []);

  useEffect(() => {
    if (!ytReady || !activeMovie?.videoKey) return;

    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (error) {
        console.warn("Failed to destroy previous trailer player:", error);
      }
      playerRef.current = null;
    }

    const timer = setTimeout(() => {
      const containerId = `yt-player-${activeMovie.id}`;
      const container = document.getElementById(containerId);
      if (!container || !window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player(containerId, {
        videoId: activeMovie.videoKey,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: isMuted ? 1 : 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          enablejsapi: 1,
          start: 10,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setVideoReady(true);
            event.target.seekTo(10, true);
            event.target.playVideo();
            if (isMuted) event.target.mute();
          },
          onStateChange: (event: any) => {
            if (event.data === 1) setVideoReady(true);
            if (event.data === 0) {
              setActiveIndex((current) => (current + 1) % Math.max(movies.length, 1));
            }
          },
          onError: () => {
            setVideoReady(false);
          },
        },
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [ytReady, activeMovie, isMuted, movies.length]);

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.mute === "function") {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
    }
  }, [isMuted, activeMovie?.id]);

  const fetchUpcomingMovies = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/tmdb/movie/upcoming?page=1`);
      if (!response.ok) return;

      const data = await response.json();
      const results = (data.results || []).slice(0, 8);

      const moviesWithVideos = await Promise.all(
        results.map(async (movie: Movie) => {
          let videoKey: string | undefined;
          let logoUrl: string | undefined;

          try {
            const videoResponse = await fetch(`${apiUrl}/api/tmdb-movie/${movie.id}?append_to_response=videos`);
            if (videoResponse.ok) {
              const videoData = await videoResponse.json();
              const videos = videoData.data?.videos?.results || videoData.videos?.results || [];
              const trailer = videos.find(
                (v: Video) =>
                  v.site === "YouTube" &&
                  (v.type === "Trailer" || v.type === "Teaser" || v.type === "Clip")
              );
              videoKey = trailer?.key || extractYouTubeKey(trailer?.key || "");
            }
          } catch (error) {
            console.warn("Trailer lookup failed:", error);
          }

          try {
            const imagesResponse = await fetch(`${apiUrl}/api/tmdb/movie/${movie.id}/images`);
            if (imagesResponse.ok) {
              const imagesData = await imagesResponse.json();
              const logos = imagesData.logos || [];
              const bestLogo = logos.find((logo: any) => logo.iso_639_1 === "en") || logos[0];
              if (bestLogo?.file_path) {
                logoUrl = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
              }
            }
          } catch (error) {
            console.warn("Logo lookup failed:", error);
          }

          return { ...movie, videoKey, logoUrl };
        })
      );

      setMovies(moviesWithVideos.filter((movie) => movie.videoKey));
    } catch (error) {
      console.error("Failed to fetch trailer movies:", error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (path?: string, size = "original") => {
    if (!path) return "/placeholder-backdrop.jpg";
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  const featuredGenres = useMemo(() => {
    if (!activeMovie?.genre_ids?.length) return "Feature film";
    return activeMovie.genre_ids.slice(0, 3).map((id) => TMDB_GENRES[id]).filter(Boolean).join(" • ");
  }, [activeMovie]);

  const openDetails = (movie: MovieWithVideo) => {
    router.push(`/tmdb-movie/${movie.id}?type=movie`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0b0d] text-white">
      <Navbar />

      <main className="relative pb-20">
        <section className="relative overflow-hidden border-b border-white/10 bg-[#121212]">
          <div className="absolute inset-0">
            {activeMovie?.videoKey && (
              <div
                id={`yt-player-${activeMovie.id}`}
                className="h-full w-full"
                style={{ filter: "brightness(0.7) saturate(1.1)" }}
              />
            )}
            {!activeMovie?.videoKey && (
              <img
                src={getImageUrl(activeMovie?.backdrop_path, "original")}
                alt={activeMovie?.title || "Featured trailer"}
                className="h-full w-full object-cover opacity-40"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0d] via-[#0b0b0d]/70 to-[#0b0b0d]/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/35 to-[#0b0b0d]/80" />
          </div>

          <div className="relative z-10 mx-auto max-w-[1600px] px-4 pb-10 pt-8 md:px-8 lg:px-12">
            <div className="mb-5 flex flex-wrap items-center gap-3 py-2 text-sm text-white/70">
              {TRAILER_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div className="max-w-3xl pb-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeMovie?.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    transition={{ duration: 0.35 }}
                  >
                    {activeMovie?.logoUrl ? (
                      <img
                        src={activeMovie.logoUrl}
                        alt={activeMovie.title}
                        className="h-12 w-auto md:h-20"
                      />
                    ) : (
                      <div className="mb-6 flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-red-500" />
                        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                          Featured trailer
                        </span>
                      </div>
                    )}

                    <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">
                      {activeMovie?.title}
                    </h1>

                    <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-white/75">
                      <span className="flex items-center gap-2 font-medium text-red-400">
                        <Star className="h-4 w-4 fill-red-500" />
                        {activeMovie?.vote_average?.toFixed(1) || "8.7"}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {activeMovie?.release_date ? new Date(activeMovie.release_date).getFullYear() : "2025"}
                      </span>
                      <span className="text-white/60">{featuredGenres}</span>
                    </div>

                    <p className="mt-5 max-w-xl text-base leading-7 text-white/80 md:text-lg">
                      {activeMovie?.overview ||
                        "Binge-worthy action, suspense, and spectacle from the hottest new releases in streaming."}
                    </p>

                    <div className="mt-7 flex flex-wrap items-center gap-4">
                      <button
                        onClick={() => openDetails(activeMovie)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:scale-[1.02]"
                      >
                        <Play className="h-4 w-4 fill-black" />
                        Play trailer
                      </button>

                      <button
                        onClick={() => openDetails(activeMovie)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                      >
                        <Info className="h-4 w-4" />
                        More info
                      </button>

                      <button
                        onClick={() => setIsMuted((prev) => !prev)}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 bg-black/20 p-3 text-white/90 backdrop-blur-sm transition hover:bg-white/10"
                        aria-label="Toggle mute"
                      >
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="relative h-[480px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0d] shadow-[0_30px_80px_rgba(0,0,0,0.55)] md:h-[540px]">
                <div className="absolute inset-0">
                  {activeMovie?.videoKey && (
                    <div className="h-full w-full bg-black/20" style={{ minHeight: "100%" }} />
                  )}
                  {!activeMovie?.videoKey && (
                    <img
                      src={getImageUrl(activeMovie?.backdrop_path, "w780")}
                      alt={activeMovie?.title}
                      className="h-full w-full object-cover opacity-80"
                    />
                  )}
                </div>

                <div className="absolute inset-0 z-10">
                  {activeMovie?.videoKey && (
                    <div
                      id={`yt-player-${activeMovie.id}`}
                      className="h-full w-full"
                    />
                  )}
                </div>

                <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#0b0b0d] via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between p-4 md:p-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/65">Now playing</p>
                    <p className="mt-2 text-lg font-bold text-white md:text-xl">{activeMovie?.title}</p>
                  </div>

                  <button
                    onClick={() => setIsMuted((prev) => !prev)}
                    className="rounded-full border border-white/20 bg-black/35 p-2.5 text-white/90 backdrop-blur-sm transition hover:bg-white/10"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-4 pb-12 pt-8 md:px-8 lg:px-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-red-400">
                <Flame className="h-4 w-4" />
                Trending trailers
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Freshly added</h2>
            </div>

            <button className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 md:inline-flex">
              Browse all
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {movies.map((movie, index) => (
              <motion.button
                key={movie.id}
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ duration: 0.2 }}
                onClick={() => setActiveIndex(index)}
                className={`group relative overflow-hidden rounded-[24px] border text-left transition ${
                  activeIndex === index ? "border-red-500/70 ring-2 ring-red-500/35" : "border-white/10"
                }`}
              >
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={getImageUrl(movie.backdrop_path || movie.poster_path, "w500")}
                    alt={movie.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/20 to-transparent" />

                  <div className="absolute left-4 top-4 rounded-full bg-black/50 p-2 backdrop-blur-sm">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-white/60">Trailer</p>
                        <h3 className="mt-2 text-xl font-bold text-white">{movie.title}</h3>
                      </div>

                      <div className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-red-400">
                        {movie.vote_average?.toFixed(1) || "8.7"}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
