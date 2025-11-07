#!/bin/bash

# HomeFlix Service Installation Script
echo "🔧 Installing HomeFlix as a system service..."

# Copy service file to systemd directory
sudo cp homeflix.service /etc/systemd/system/

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable homeflix.service

echo "✅ HomeFlix service installed successfully!"
echo ""
echo "📋 Service Management Commands:"
echo "  Start service:    sudo systemctl start homeflix"
echo "  Stop service:     sudo systemctl stop homeflix"
echo "  Restart service:  sudo systemctl restart homeflix"
echo "  Check status:     sudo systemctl status homeflix"
echo "  View logs:        sudo journalctl -u homeflix -f"
echo "  View app logs:    tail -f /home/azad/homeflix-local/homeflix-wifi/homeflix.log"
echo ""
echo "🚀 Starting HomeFlix service now..."
sudo systemctl start homeflix

echo ""
echo "🎉 Installation complete!"
echo "HomeFlix will now start automatically when your system boots up."
echo ""
echo "Check service status with: sudo systemctl status homeflix"