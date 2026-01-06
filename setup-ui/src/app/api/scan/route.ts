import { NextRequest, NextResponse } from 'next/server';

interface ScanRequest {
  paths: {
    primary: string;
    downloads: string;
    additional: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const { paths }: ScanRequest = await request.json();
    
    // Start media scan via backend API
    const response = await fetch('http://homeflix-backend:8252/api/admin/scan/full', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paths: [paths.primary, paths.downloads, ...paths.additional].filter(Boolean),
        generateAssets: true,
        updateMetadata: true
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to start media scan');
    }
    
    const result = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Media scan started successfully',
      scanId: result.scanId || 'default'
    });
  } catch (error) {
    console.error('Scan start error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start scan' 
      },
      { status: 500 }
    );
  }
}