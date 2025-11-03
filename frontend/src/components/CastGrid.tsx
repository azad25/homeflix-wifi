"use client";

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

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

interface CastGridProps {
  mediaId: number;
  maxItems?: number;
  showCharacters?: boolean;
  className?: string;
}

const CastGrid: React.FC<CastGridProps> = ({ 
  mediaId, 
  maxItems = 6, 
  showCharacters = true,
  className = "" 
}) => {
  const [castData, setCastData] = useState<CastData>({ cast: [], crew: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCastImages = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/media/${mediaId}/cast-images`);
        
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
  }, [mediaId]);

  if (loading) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 ${className}`}>
        {Array.from({ length: maxItems }).map((_, index) => (
          <div key={index} className="text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="h-4 bg-gray-700 rounded animate-pulse mb-1"></div>
            <div className="h-3 bg-gray-800 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || castData.cast.length === 0) {
    return null;
  }

  const displayCast = castData.cast.slice(0, maxItems);

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 ${className}`}>
      {displayCast.map((member, index) => (
        <div key={member.id || index} className="text-center group">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-gray-700 mx-auto mb-2 transition-transform group-hover:scale-105">
            {member.image_url ? (
              <img
                src={member.image_url}
                alt={member.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center ${member.image_url ? 'hidden' : ''}`}>
              <User className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="px-1">
            <p className="text-white text-sm font-medium truncate">{member.name}</p>
            {showCharacters && member.character && (
              <p className="text-white/60 text-xs truncate">{member.character}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CastGrid;