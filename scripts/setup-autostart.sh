#!/bin/bash

echo "🔧 HomeFlix Auto-Start Setup"
echo "============================"
echo ""
echo "Choose your preferred auto-start method:"
echo ""
echo "1. Desktop Autostart (Recommended) - Starts with GUI login"
echo "2. Cron Job - Starts in background after boot"
echo "3. Improved Systemd Service - System service with dependencies"
echo "4. Manual start only"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "Setting up Desktop Autostart..."
        mkdir -p ~/.config/autostart
        cp homeflix-autostart.desktop ~/.config/autostart/
        echo "✅ Desktop autostart configured!"
        echo "HomeFlix will start 30 seconds after you log in to your desktop"
        ;;
    2)
        echo "Setting up Cron Job..."
        ./setup-cron.sh
        ;;
    3)
        echo "Setting up Improved Systemd Service..."
        sudo cp homeflix-improved.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable homeflix-improved.service
        echo "✅ Improved systemd service configured!"
        echo "Service will start after graphical session is ready"
        ;;
    4)
        echo "No auto-start configured. Use ./start.sh to start manually."
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "📋 Management Commands:"
echo "  View startup logs:    tail -f startup.log"
echo "  View cron logs:       tail -f cron-startup.log"
echo "  Stop HomeFlix:        pkill -f 'go run server.go' && pkill -f 'npm run start'"
echo "  Manual start:         ./start.sh"
echo ""
echo "🎉 Setup complete!"