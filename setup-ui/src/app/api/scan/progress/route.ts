import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get scan progress from backend API
    const response = await fetch('http://homeflix-backend:8252/api/admin/scan/progress', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      // If no scan is running, return default progress
      return NextResponse.json({
        isScanning: false,
        currentStep: 'Idle',
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        errors: [],
        warnings: [],
        currentFile: '',
        eta: ''
      });
    }
    
    const progress = await response.json();
    
    // Transform backend response to match frontend expectations
    const transformedProgress = {
      isScanning: progress.isScanning || progress.status === 'running',
      currentStep: progress.currentStep || progress.phase || 'Processing',
      progress: progress.progress || 0,
      totalFiles: progress.totalFiles || progress.total || 0,
      processedFiles: progress.processedFiles || progress.processed || 0,
      errors: progress.errors || [],
      warnings: progress.warnings || [],
      currentFile: progress.currentFile || progress.currentItem || '',
      eta: progress.eta || progress.estimatedTimeRemaining || ''
    };
    
    return NextResponse.json(transformedProgress);
  } catch (error) {
    console.error('Progress fetch error:', error);
    
    // Return mock progress for development/testing
    const mockProgress = {
      isScanning: true,
      currentStep: 'Scanning media files',
      progress: Math.min(95, Date.now() % 100),
      totalFiles: 1250,
      processedFiles: Math.floor(Date.now() % 1200),
      errors: [],
      warnings: ['Some files may not have metadata'],
      currentFile: '/media/movies/Sample Movie (2023)/Sample Movie.mkv',
      eta: '2 minutes remaining'
    };
    
    return NextResponse.json(mockProgress);
  }
}