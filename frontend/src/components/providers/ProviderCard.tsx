"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

interface ProviderCardProps {
    id: number;
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
    id,
    name,
    logoUrl,
    primaryColor,
    secondaryColor,
}) => {
    return (
        <Link href={`/providers/${id}`}>
            <motion.div
                className="group relative w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer"
                initial="initial"
                whileHover="hover"
                whileTap="tap"
                variants={{
                    initial: { scale: 1 },
                    hover: { scale: 1.02 },
                    tap: { scale: 0.98 }
                }}
            >
                {/* Dynamic Background Gradient */}
                <div
                    className="absolute inset-0 transition-opacity duration-500"
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}20 0%, #1a1a1a 100%)`
                    }}
                />

                {/* Glass Layer */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] border border-white/10 rounded-2xl transition-all duration-300 group-hover:border-white/20" />

                {/* Hover Glow Effect */}
                <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                        background: `radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), ${primaryColor}40, transparent 40%)`
                    }}
                />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
                    <motion.div
                        layoutId={`provider-logo-${id}`}
                        className="relative w-full h-full flex items-center justify-center"
                        variants={{
                            initial: { y: 0, scale: 1 },
                            hover: { y: -10, scale: 1.1 }
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        {/* Logo Glow */}
                        <div
                            className="absolute inset-0 blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"
                            style={{ background: primaryColor }}
                        />

                        <img
                            src={logoUrl}
                            alt={name}
                            className="relative w-auto h-16 md:h-20 object-contain drop-shadow-2xl"
                            loading="lazy"
                        />
                    </motion.div>

                    {/* Explore Button / Call to Action */}
                    <motion.div
                        className="absolute bottom-6 flex items-center gap-2 text-white font-medium text-sm tracking-wide bg-black/40 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md"
                        variants={{
                            initial: { opacity: 0, y: 20 },
                            hover: { opacity: 1, y: 0 }
                        }}
                        transition={{ duration: 0.2 }}
                    >
                        <span>Explore</span>
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                </div>

                {/* Decorative Elements */}
                <div
                    className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-bl-full opacity-50"
                    style={{ background: `linear-gradient(to bottom left, ${primaryColor}30, transparent)` }}
                />
            </motion.div>
        </Link>
    );
};

export default ProviderCard;
