'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Media } from '@/types/media';
import { getMediaById } from '@/lib/api/media';
import Navbar from '@/components/Navbar';
import ScrollXHero from '@/components/scrollx/ScrollXHero';
import RecommendationSection from '@/components/RecommendationSection';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export default function MovieInfoPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [media, setMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoading(true);
        setError(null);
        const mediaData = await getMediaById(id);
        setMedia(mediaData);
      } catch (err) {
        console.error('Error fetching media:', err);
        setError('Failed to load movie information');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMedia();
    }
  }, [id]);

  const handlePlay = (mediaItem: Media) => {
    // Handle play action
    console.log('Playing:', mediaItem.title);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <ErrorMessage message={error || 'Movie not found'} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* Hero Section using ScrollXHero */}
      <ScrollXHero
        featuredMedia={[media]}
        onPlay={handlePlay}
        onInfo={() => {}}
        pageType="movie"
      />

      {/* Recommendations Section */}
      <div className="relative z-10 bg-black">
        <RecommendationSection 
          currentMedia={media}
          onPlay={handlePlay}
          onInfo={() => {}}
        />
      </div>
    </div>
  );
}
