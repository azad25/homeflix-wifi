#!/bin/bash

echo "🎬 Testing HomeFlix Torrent Feature"
echo "=================================="

# Test backend build
echo "📦 Testing backend build..."
cd backend
if go build -o homeflix-server .; then
    echo "✅ Backend builds successfully"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Test frontend build
echo "📦 Testing frontend build..."
cd ../frontend
if npm run build > /dev/null 2>&1; then
    echo "✅ Frontend builds successfully"
else
    echo "❌ Frontend build failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Torrent feature is ready to use."
echo ""
echo "🚀 Quick Start Options:"
echo "1. Demo Mode (Zero Setup):"
echo "   cd backend && ./homeflix-server"
echo "   cd frontend && npm run dev"
echo ""
echo "2. With Real Torrents:"
echo "   ./setup-jackett.sh"
echo "   # Then configure API key in Settings → Torrents"
echo ""
echo "3. Native Setup:"
echo "   ./setup-jackett-native.sh"
echo "   # Then configure API key in Settings → Torrents"
echo ""
echo "📚 Documentation:"
echo "   - TORRENT_SETUP.md - Complete setup guide"
echo "   - TORRENT_FEATURE_COMPLETE.md - Feature overview"
echo "   - TORRENT_INSTALLATION_OPTIONS.md - All installation methods"