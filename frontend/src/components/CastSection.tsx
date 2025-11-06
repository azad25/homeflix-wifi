"use client";

import React, { useState, useEffect } from 'react';
import { User, Users as Cast, User as Director, ChevronDown, ChevronUp } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';

interface CastMemberData {
  id: number;
  name: string;
  character?: string;
  job?: string;
  image_url: string;
  order?: number;
}

interface CastData {
  cast: CastMemberData[];
  crew: CastMemberData[];
}

interface CastSectionProps {
  media: Media;
  showMoreInfo: boolean;
  setShowMoreInfo: (show: boolean) => void;
}

const CastSection: React.FC<CastSectionProps> = ({ 
  media, 
  showMoreInfo, 
  setShowMoreInfo 
}) => {
  const [castData, setCastData] = useState<CastData>({ cast: [], crew: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCastImages = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/media/${media.id}/cast-images`);
        
        if (response.ok) {
          const data = await response.json();
          setCastData(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch cast images:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCastImages();
  }, [media.id]);

  // Helper function to render a person with image
  const renderPerson = (
    person: { name: string; role: string }, 
    imageUrl?: string, 
    index?: number
  ) => (
    <div 
      key={index || person.name} 
      className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={person.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to icon on error
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <User className={`w-6 h-6 text-gray-400 ${imageUrl ? 'hidden' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{person.name}</p>
        <p className="text-white/60 text-sm truncate">{person.role}</p>
      </div>
    </div>
  );

  // Get directors from media data
  const directors = media.director || [];
  
  // Get cast from media data
  const stars = media.stars || [];

  if (loading) {
    return (
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Cast & Crew</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!directors.length && !stars.length) {
    return null;
  }

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-white mb-6">Cast & Crew</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Director Section */}
        {directors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Director className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-white">
                Director{directors.length > 1 ? 's' : ''}
              </h3>
            </div>
            <div className="space-y-3">
              {directors.map((director, index) => {
                // Find matching crew member with image
                const crewMember = castData?.crew?.find(c => 
                  c.name.toLowerCase() === director.toLowerCase() && 
                  c.job === 'Director'
                );
                
                return renderPerson(
                  { name: director, role: 'Director' },
                  crewMember?.image_url,
                  index
                );
              })}
            </div>
          </div>
        )}

        {/* Cast Section */}
        {stars.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Cast className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-white">Cast</h3>
            </div>
            <div className="space-y-3">
              {stars.slice(0, 6).map((actor, index) => {
                // Find matching cast member with image
                const castMember = castData?.cast?.find(c => 
                  c.name.toLowerCase() === actor.toLowerCase()
                );
                
                return renderPerson(
                  { name: actor, role: 'Actor' },
                  castMember?.image_url,
                  index
                );
              })}
              
              {stars.length > 6 && (
                <div className="text-center">
                  <button
                    onClick={() => setShowMoreInfo(!showMoreInfo)}
                    className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 mx-auto"
                  >
                    {showMoreInfo ? (
                      <>
                        Show Less <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show {stars.length - 6} More <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  {showMoreInfo && (
                    <div className="mt-3 space-y-3">
                      {stars.slice(6).map((actor, index) => {
                        const castMember = castData?.cast?.find(c => 
                          c.name.toLowerCase() === actor.toLowerCase()
                        );
                        
                        return renderPerson(
                          { name: actor, role: 'Actor' },
                          castMember?.image_url,
                          index + 6
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CastSection;