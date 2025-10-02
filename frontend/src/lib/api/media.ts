import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';

export async function getMediaById(uuid: string): Promise<Media> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/media/${uuid}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch media with uuid ${uuid}: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getAllMedia(): Promise<Media[]> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/media`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getMediaByType(type: 'movie' | 'tv' | 'episode'): Promise<Media[]> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/media?type=${type}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} media: ${response.statusText}`);
  }
  
  return response.json();
}
