"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, User, Menu, X, Film, Tv, Music, List, Compass, Settings, HelpCircle, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import NavigationLink from "./NavigationLink";
import { useNavigate } from "@/hooks/useNavigate";
import { getApiUrl } from "@/lib/api";
import NotificationDropdown from "./NotificationDropdown";
import { Notification, NotificationResponse, NotificationCountResponse } from "@/types/notifications";
import { getCachedNavData, cacheNavData } from "@/utils/navCache";

interface NavbarProps {
  onSearch?: (query: string) => void;
}

interface TMDBSearchResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  media_type: "movie" | "tv";
  adult: boolean;
  genre_ids: number[];
  is_local?: boolean;
  logo_path?: string;
}

interface TMDBSuggestionsResponse {
  results: TMDBSearchResult[];
  total_results: number;
}

const Navbar: React.FC<NavbarProps> = ({ onSearch }) => {
  const navigate = useNavigate();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TMDBSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [dynamicPages, setDynamicPages] = useState<Array<{ slug: string; title: string }>>([]);
  const [homePageSlug, setHomePageSlug] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Preload dynamic pages and home page data immediately
  useEffect(() => {
    const loadNavData = async () => {
      try {
        // Try to load from cache first for instant display
        const cachedData = getCachedNavData();
        if (cachedData) {
          setDynamicPages(cachedData.dynamicPages);
          setHomePageSlug(cachedData.homePageSlug);
          setIsInitialLoad(false);
        }

        const apiUrl = getApiUrl();

        // Load both nav pages and home page in parallel
        const [navResponse, homeResponse] = await Promise.all([
          fetch(`${apiUrl}/api/pages/nav`).then(r => r.ok ? r.json() : []),
          fetch(`${apiUrl}/api/pages/home`).then(r => r.ok ? r.json() : null)
        ]);

        // Set dynamic pages
        const newDynamicPages = Array.isArray(navResponse)
          ? navResponse.map((p: any) => ({ slug: p.slug, title: p.title }))
          : [];

        // Set home page slug
        const newHomePageSlug = (homeResponse && homeResponse.slug) ? homeResponse.slug : null;

        setDynamicPages(newDynamicPages);
        setHomePageSlug(newHomePageSlug);
        setIsInitialLoad(false);

        // Cache the results
        cacheNavData(newDynamicPages, newHomePageSlug);

      } catch (error) {
        console.error('Failed to load navigation data:', error);
        setDynamicPages([]);
        setHomePageSlug(null);
        setIsInitialLoad(false);
      }
    };

    loadNavData();
  }, []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Notification state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const apiUrl = getApiUrl();

      // Fetch notifications
      const response = await fetch(`${apiUrl}/api/notifications?limit=50`);
      if (response.ok) {
        const data: NotificationResponse = await response.json();
        setNotifications(data.notifications || []);
      }

      // Fetch notification count separately
      const countResponse = await fetch(`${apiUrl}/api/notifications/count`);
      if (countResponse.ok) {
        const countData: NotificationCountResponse = await countResponse.json();
        setNotificationCount(countData.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchNotifications();

    // Refresh notifications every 2 minutes
    const interval = setInterval(() => {
      fetchNotifications();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle clicks outside notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for suggestions
  useEffect(() => {
    console.log(`🔍 Search query changed: "${searchQuery}" (length: ${searchQuery.trim().length})`);

    if (searchQuery.trim().length >= 2) { // Changed from > 1 to >= 2 for clarity
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Triggering search for: "${searchQuery.trim()}"`);
        fetchSuggestions(searchQuery.trim());
      }, 300);

      return () => {
        console.log(`🚫 Clearing timeout for: "${searchQuery.trim()}"`);
        clearTimeout(timeoutId);
      };
    } else {
      console.log(`❌ Query too short (${searchQuery.trim().length} chars), clearing suggestions`);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) return;

    setIsLoadingSuggestions(true);
    console.log(`🔍 Fetching TMDB suggestions for: "${query}"`);

    try {
      const apiUrl = getApiUrl();

      // Fetch only TMDB results
      const response = await fetch(`${apiUrl}/api/tmdb/suggestions?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        console.warn(`⚠️ TMDB search failed with status: ${response.status}`);
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const tmdbData: TMDBSuggestionsResponse = await response.json();
      console.log(`🎬 TMDB search results:`, tmdbData);

      const tmdbResults = tmdbData.results || [];

      // Mark all results as TMDB (not local)
      const processedResults = tmdbResults.map(item => ({
        ...item,
        is_local: false
      }));

      // Sort by popularity and vote average
      processedResults.sort((a, b) => {
        // First by vote average
        if (b.vote_average !== a.vote_average) {
          return b.vote_average - a.vote_average;
        }

        // Then by popularity
        return b.popularity - a.popularity;
      });

      console.log(`🎯 Final TMDB suggestions: ${processedResults.length} results`);
      setSuggestions(processedResults);
      setShowSuggestions(processedResults.length > 0);

    } catch (error) {
      console.error("Error fetching TMDB suggestions:", error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        // Navigate to search page if no onSearch handler provided
        navigate.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setIsSearchOpen(false);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: TMDBSearchResult) => {
    // Navigate directly to TMDB movie/TV page with media type (all results are TMDB now)
    navigate.push(`/tmdb-movie/${suggestion.id}?type=${suggestion.media_type}`);
    setIsSearchOpen(false);
    setShowSuggestions(false);
    setSearchQuery("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log(`📝 Input changed: "${value}"`);
    setSearchQuery(value);

    // Show suggestions immediately if we have cached results and user is typing
    if (value.trim().length > 1 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputFocus = () => {
    console.log(`🎯 Input focused, suggestions available: ${suggestions.length}`);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const getPosterUrl = (posterPath: string) => {
    if (!posterPath) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA0OCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAzMkMzMC42Mjc0IDMyIDM2IDI2LjYyNzQgMzYgMjBDMzYgMTMuMzcyNiAzMC42Mjc0IDggMjQgOEMxNy4zNzI2IDggMTIgMTMuMzcyNiAxMiAyMEMxMiAyNi42Mjc0IDE3LjM3MjYgMzIgMjQgMzJaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik0xMiA0NEMxMiAzNi4yNjggMTguMjY4IDMwIDI2IDMwSDIyQzI5LjczMiAzMCAzNiAzNi4yNjggMzYgNDRWNTZIMTJWNDRaIiBmaWxsPSIjNkI3Mjg4Ii8+Cjwvc3ZnPgo=';
    }
    if (posterPath.startsWith('/api/')) {
      return `${getApiUrl()}${posterPath}`;
    }
    return `https://image.tmdb.org/t/p/w92${posterPath}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const year = new Date(dateString).getFullYear();
    return year ? `(${year})` : '';
  };

  interface NavItem {
    name: string;
    href: string;
  }

  const navItems: NavItem[] = [
    // { name: "Movies", href: "/movies" },
    // { name: "TV Shows", href: "/tv-shows" },
    // { name: "Music", href: "/music" },
    // { name: "Trailers", href: "/trailers" },
    // { name: "New & Popular", href: "/new-popular" },
    // { name: "My List", href: "/my-list" },
    // { name: "Browse", href: "/browse" },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? "bg-black/95 backdrop-blur-sm" : "bg-transparent"
        }`}
    >
      <div className="px-4 md:px-8 lg:px-16">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <NavigationLink
              href="/"
              className="text-red-600 text-2xl font-bold hover:text-red-500 transition-colors cursor-pointer"
              onClick={(e) => {
                // If we are already on the home page, force a reload to refresh content and fix stuck spinner
                if (pathname === "/") {
                  e.preventDefault();
                  window.location.reload();
                }
                // If there's a custom home page and user wants to bypass it, add ?original=true
                // This can be triggered by holding Ctrl/Cmd while clicking
                if (homePageSlug && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  navigate.push("/?original=true");
                }
              }}
            >
              HomeFlix
            </NavigationLink>

            {/* Desktop Navigation - Home page is filtered out of this list by backend (is_nav_visible=false) */}
            <div className="hidden md:flex items-center gap-6">
              {!isInitialLoad && [...navItems, ...dynamicPages.map(p => ({ name: p.title, href: `/${p.slug}` }))].map((item) => {
                const isActive = pathname === item.href;
                return (
                  <NavigationLink
                    key={item.name}
                    href={item.href}
                    target={item.href == "/now-playing" ? "_blank" : ""}
                    className={`transition-colors text-sm font-medium ${isActive
                      ? "text-red-500"
                      : "text-white/80 hover:text-white hover:text-red-400"
                      }`}
                  >
                    {item.name}
                  </NavigationLink>
                );
              })}
              {isInitialLoad && (
                <>
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <NavigationLink
                        key={item.name}
                        href={item.href}
                        target={item.href == "/now-playing" ? "_blank" : ""}
                        className={`transition-colors text-sm font-medium ${isActive
                          ? "text-red-500"
                          : "text-white/80 hover:text-white hover:text-red-400"
                          }`}
                      >
                        {item.name}
                      </NavigationLink>
                    );
                  })}
                  {/* Loading placeholder for dynamic pages */}
                  <div className="w-16 h-4 bg-gray-700/50 animate-pulse rounded"></div>
                </>
              )}
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="relative">
                  <motion.form
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    onSubmit={handleSearch}
                    className="flex items-center bg-black/50 border border-white/30 rounded-lg overflow-hidden"
                  >
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      placeholder="Search movies & TV shows..."
                      className="flex-1 bg-transparent text-white px-4 py-2 outline-none placeholder-white/50"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setShowSuggestions(false);
                        setSearchQuery("");
                      }}
                      className="p-2 text-white/70 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.form>

                  {/* Search Suggestions Dropdown */}
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        ref={suggestionsRef}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto"
                      >
                        {isLoadingSuggestions ? (
                          <div className="p-4 text-center text-white/60">
                            <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full mx-auto"></div>
                            <span className="ml-2">Searching...</span>
                          </div>
                        ) : suggestions.length > 0 ? (
                          <div className="py-2">
                            {suggestions.slice(0, 5).map((suggestion) => (
                              <button
                                key={`${suggestion.media_type}-${suggestion.id}`}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 group"
                              >
                                <div className="flex-shrink-0">
                                  <img
                                    src={getPosterUrl(suggestion.poster_path)}
                                    alt={suggestion.title}
                                    className="w-12 h-16 object-cover rounded bg-gray-800"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA0OCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAzMkMzMC42Mjc0IDMyIDM2IDI2LjYyNzQgMzYgMjBDMzYgMTMuMzcyNiAzMC42Mjc0IDggMjQgOEMxNy4zNzI2IDggMTIgMTMuMzcyNiAxMiAyMEMxMiAyNi42Mjc0IDE3LjM3MjYgMzIgMjQgMzJaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik0xMiA0NEMxMiAzNi4yNjggMTguMjY4IDMwIDI2IDMwSDIyQzI5LjczMiAzMCAzNiAzNi4yNjggMzYgNDRWNTZIMTJWNDRaIiBmaWxsPSIjNkI3Mjg4Ii8+Cjwvc3ZnPgo=';
                                    }}

                                  />

                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {suggestion.media_type === 'movie' ? (
                                      <Film className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                    ) : (
                                      <Tv className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-white font-medium truncate group-hover:text-red-400 transition-colors">
                                        {suggestion.title}
                                      </h4>
                                    </div>

                                    <span className="text-gray-400 text-sm flex-shrink-0">
                                      {formatDate(suggestion.release_date)}
                                    </span>
                                  </div>
                                  {suggestion.overview && (
                                    <p className="text-gray-400 text-sm line-clamp-2">
                                      {suggestion.overview}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {suggestion.vote_average && suggestion.vote_average > 0 && (
                                      <span className="text-yellow-400 text-sm">
                                        ★ {suggestion.vote_average.toFixed(1)}
                                      </span>
                                    )}
                                    {suggestion.vote_count > 0 && (
                                      <span className="text-gray-500 text-xs">
                                        ({suggestion.vote_count.toLocaleString()} votes)
                                      </span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${suggestion.media_type === 'movie'
                                      ? 'text-blue-400 border-blue-400/30 bg-blue-500/10'
                                      : 'text-green-400 border-green-400/30 bg-green-500/10'
                                      }`}>
                                      {suggestion.media_type === 'movie' ? 'Movie' : 'TV Show'}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            ))}
                            {searchQuery.trim() && (
                              <div className="border-t border-white/10 mt-2 pt-2">
                                <button
                                  onClick={() => {
                                    navigate.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                                    setIsSearchOpen(false);
                                    setShowSuggestions(false);
                                  }}
                                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-white/10 transition-colors text-sm"
                                >
                                  See all results for "{searchQuery}"
                                </button>
                              </div>
                            )}
                          </div>
                        ) : searchQuery.trim() && !isLoadingSuggestions ? (
                          <div className="p-4 text-center text-white/60">
                            No results found for "{searchQuery}"
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="text-white/80 hover:text-white transition-colors flex items-center justify-center"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/*linked to /now-playing*/}
            <NavigationLink
              href="/now-playing"
              className="text-white/80 hover:text-white transition-colors flex items-center justify-center"
            >
              <Tv className="w-5 h-5" />
            </NavigationLink>

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="text-white/80 hover:text-white transition-colors hidden md:block relative flex items-center justify-center"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-black" />
                )}
              </button>
              <NotificationDropdown
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notifications}
                onNotificationClick={(movieId) => {
                  console.log("Navigate to movie:", movieId);
                }}
              />
            </div>


            {/* Profile */}
            <div className="relative group">
              <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              </button>

              {/* Profile Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-56 bg-black/90 rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <a href="/music" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Music
                </a>
                <a href="/my-list" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  My List
                </a>
                <a href="/browse" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  Browse
                </a>
                <hr className="border-white/20 my-2" />
                <a href="/settings" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </a>
                <a href="/providers" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  Providers
                </a>
                <a href="/trailers" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  Trailers
                </a>
                <a href="#" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Help
                </a>
                <hr className="border-white/20 my-2" />
                <a href="#" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </a>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white/80 hover:text-white transition-colors md:hidden"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black/95 rounded-lg mt-2 py-4"
          >
            {[...navItems, ...dynamicPages.map(p => ({ name: p.title, href: `/${p.slug}` }))].map((item) => {
              const isActive = pathname === item.href;
              return (
                <NavigationLink
                  key={item.name}
                  href={item.href}
                  target={item.href == "/now-playing" ? "_blank" : ""}
                  className={`block px-4 py-3 transition-colors ${isActive
                    ? "text-red-500 bg-red-500/10 border-l-4 border-red-500"
                    : "text-white/80 hover:text-white hover:bg-white/10 hover:text-red-400"
                    }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </NavigationLink>
              );
            })}
            {isInitialLoad && dynamicPages.length === 0 && (
              <div className="px-4 py-3">
                <div className="w-24 h-4 bg-gray-700/50 animate-pulse rounded"></div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;
