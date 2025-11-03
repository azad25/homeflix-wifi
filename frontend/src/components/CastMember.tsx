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

interface CastMemberProps {
  mediaId: number;
  name: string;
  role: string;
  type: 'cast' | 'crew';
  className?: string;
}

const CastMember: React.FC<CastMemberProps> = ({ 
  mediaId, 
  name, 
  role, 
  type, 
  className = "" 
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCastImage = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/media/${mediaId}/cast-images`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Find the matching cast/crew member
          const members = type === 'cast' ? data.cast : data.crew;
          const member = members?.find((m: CastMemberData) => 
            m.name.toLowerCase() === name.toLowerCase()
          );
          
          if (member && member.image_url) {
            setImageUrl(member.image_url);
          } else {
            setError(true);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch cast image:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCastImage();
  }, [mediaId, name, type]);

  return (
    <div className={`flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors ${className}`}>
      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
        {loading ? (
          <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : imageUrl && !error ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <User className="w-6 h-6 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{name}</p>
        <p className="text-white/60 text-sm truncate">{role}</p>
      </div>
    </div>
  );
};

export default CastMember;