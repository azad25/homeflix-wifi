"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Bell, User, Menu, X } from "lucide-react";
import Image from "next/image";

interface NavbarProps {
  onSearch?: (query: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSearch }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        // Navigate to search page if no onSearch handler provided
        window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
      }
      setIsSearchOpen(false);
    }
  };

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Movies", href: "/movies" },
    { name: "TV Shows", href: "/tv-shows" },
    { name: "My List", href: "/my-list" },
    { name: "Browse", href: "/browse" },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled ? "bg-black/95 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div className="px-4 md:px-8 lg:px-16">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <div className="text-red-600 text-2xl font-bold">
              HomeFlix
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-white/80 hover:text-white transition-colors text-sm"
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              {isSearchOpen ? (
                <motion.form
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  onSubmit={handleSearch}
                  className="flex items-center bg-black/50 border border-white/30 rounded-lg overflow-hidden"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, shows..."
                    className="flex-1 bg-transparent text-white px-4 py-2 outline-none placeholder-white/50"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2 text-white/70 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.form>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Notifications */}
            <button className="text-white/80 hover:text-white transition-colors hidden md:block">
              <Bell className="w-5 h-5" />
            </button>

            {/* Profile */}
            <div className="relative group">
              <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              </button>

              {/* Profile Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <a href="#" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10">
                  Profile
                </a>
                <a href="#" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10">
                  Settings
                </a>
                <a href="#" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10">
                  Help
                </a>
                <hr className="border-white/20 my-2" />
                <a href="#" className="block px-4 py-2 text-white/80 hover:text-white hover:bg-white/10">
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
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;
