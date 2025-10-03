'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Film } from 'lucide-react';
import { MagneticButton, FloatingElement } from '@/components/scrollx';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center px-4 max-w-2xl mx-auto">
        <FloatingElement>
          <Film className="w-24 h-24 text-red-500 mx-auto mb-8" />
        </FloatingElement>
        
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-300 mb-6">
          Page Not Found
        </h2>
        <p className="text-gray-400 text-lg mb-12 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist. It might have been moved, deleted, or you entered the wrong URL.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/">
            <MagneticButton className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2">
              <Home className="w-5 h-5" />
              Go Home
            </MagneticButton>
          </Link>
          
          <button 
            onClick={() => window.history.back()}
            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
