"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VideoPlayer from '../VideoPlayer';
import { Media } from '@/types/media';

interface VideoPlayerOverlayProps {
    media: Media | null;
    isOpen: boolean;
    onClose: () => void;
    startTime?: number;
    forceStartFromBeginning?: boolean;
}

export default function VideoPlayerOverlay({
    media,
    isOpen,
    onClose,
    startTime = 0,
    forceStartFromBeginning = false,
}: VideoPlayerOverlayProps) {
    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    // Prevent body scroll when overlay is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Stop all page activities by hiding the page content
            const mainContent = document.querySelector('body > div:first-child');
            if (mainContent && mainContent instanceof HTMLElement) {
                mainContent.style.visibility = 'hidden';
                mainContent.style.pointerEvents = 'none';
            }
        } else {
            document.body.style.overflow = 'auto';
            // Restore page content visibility
            const mainContent = document.querySelector('body > div:first-child');
            if (mainContent && mainContent instanceof HTMLElement) {
                mainContent.style.visibility = 'visible';
                mainContent.style.pointerEvents = 'auto';
            }
        }

        return () => {
            document.body.style.overflow = 'auto';
            const mainContent = document.querySelector('body > div:first-child');
            if (mainContent && mainContent instanceof HTMLElement) {
                mainContent.style.visibility = 'visible';
                mainContent.style.pointerEvents = 'auto';
            }
        };
    }, [isOpen]);

    if (!media) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                >
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ backdropFilter: 'blur(0px)' }}
                        animate={{ backdropFilter: 'blur(20px)' }}
                        exit={{ backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        onClick={onClose}
                    />

                    {/* Video Player Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative z-10 w-full h-full"
                    >
                        <VideoPlayer
                            media={media}
                            isOpen={isOpen}
                            onClose={onClose}
                            startTime={startTime}
                            forceStartFromBeginning={forceStartFromBeginning}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
