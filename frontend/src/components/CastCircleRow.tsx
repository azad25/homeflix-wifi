"use client";

import React, { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api';
import { Users } from 'lucide-react';

interface CastMemberData {
  id: number;
  name: string;
  character?: string;
  job?: string;
  image_url: string;
}

interface CastData {
  cast: CastMemberData[];
  crew: CastMemberData[];
}

interface CastCircleRowProps {
  mediaId: number;
  type: 'media' | 'series';
}

const CastCircleRow: React.FC<CastCircleRowProps> = ({ mediaId, type }) => {
  const [castData, setCastData] = useState<CastData>({ cast: [], crew: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCastImages = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/${type}/${mediaId}/cast-images`);
        
        if (response.ok) {
          const data = await response.json();
          setCastData(data);
        }
      } catch (err) {
        console.error('Failed to fetch cast images:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCastImages();
  }, [mediaId, type]);

  if (loading) return null;

  // Combine directors and top cast
  const directors = castData.crew.filter(c => c.job === 'Director' || c.job === 'Executive Producer').slice(0, 2);
  const topCast = castData.cast.slice(0, 15);
  
  // Create unique list to avoid duplicates if someone is both director and cast
  const displayPeopleMap = new Map();
  
  directors.forEach(p => displayPeopleMap.set(p.id, { ...p, displayRole: p.job }));
  topCast.forEach(p => {
    if (!displayPeopleMap.has(p.id)) {
      displayPeopleMap.set(p.id, { ...p, displayRole: p.character });
    }
  });

  const displayPeople = Array.from(displayPeopleMap.values());

  if (displayPeople.length === 0) return null;

  return (
    <div className="mt-12 mb-8">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-red-500" />
        <h2 className="text-2xl font-bold text-white">Cast & Crew</h2>
      </div>
      
      <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x pt-2">
        {displayPeople.map((person, index) => (
          <div key={`${person.id}-${index}`} className="flex flex-col items-center flex-shrink-0 w-24 sm:w-28 snap-start group cursor-pointer">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-800 border-2 border-transparent group-hover:border-red-500 transition-all duration-300 flex items-center justify-center flex-shrink-0 shadow-lg relative">
              {person.image_url ? (
                <img
                  src={person.image_url}
                  alt={person.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <Users className={`w-8 h-8 text-gray-500 absolute ${person.image_url ? 'hidden' : ''}`} />
            </div>
            <p className="text-white text-xs sm:text-sm font-medium text-center mt-3 line-clamp-1 group-hover:text-red-400 transition-colors">{person.name}</p>
            <p className="text-white/50 text-[10px] sm:text-xs text-center line-clamp-1 mt-0.5">{person.displayRole}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CastCircleRow;
