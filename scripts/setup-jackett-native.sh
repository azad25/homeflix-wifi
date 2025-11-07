#!/bin/bash

# HomeFlix Torrent Setup Script (Native Installation)
# This script installs Jackett natively without Docker

echo "🎬 HomeFlix Torrent Setup (Native)"
echo "=================================="
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v apt &> /dev/null; then
        OS="ubuntu"
    elif command -v pacman &> /dev/null; then
        OS="arch"
    elif command -v dnf &> /dev/null; then
        OS="fedora"
    else
        OS="linux"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

echo "🔍 Detected OS: $OS"
echo ""

# Create directories
mkdir -p ~/jackett-config
mkdir -p ~/Downloads/homeflix/{Movies,TV\ Shows}
echo "📁 Created directories"
echo ""

# Install Jackett based on OS
case $OS in
    "ubuntu")
        echo "📦 Installing Jackett on Ubuntu/Debian..."
        
        # Install dependencies
        sudo apt update
        sudo apt install -y curl wget mono-complete
        
        # Download and install Jackett
        JACKETT_VERSION=$(curl -s https://api.github.com/repos/Jackett/Jackett/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
        echo "📥 Downloading Jackett $JACKETT_VERSION..."
        
        cd /tmp
        wget "https://github.com/Jackett/Jackett/releases/download/$JACKETT_VERSION/Jackett.Binaries.LinuxAMDx64.tar.gz"
        tar -xzf Jackett.Binaries.LinuxAMDx64.tar.gz
        
        # Install to /opt
        sudo mv Jackett /opt/jackett
        sudo chown -R $USER:$USER /opt/jackett
        
        # Create systemd service
        sudo tee /etc/systemd/system/jackett.service > /dev/null <<EOF
[Unit]
Description=Jackett Daemon
After=network.target

[Service]
SyslogIdentifier=jackett
Restart=always
RestartSec=5
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/jackett
ExecStart=/opt/jackett/jackett --NoUpdates
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF
        
        # Enable and start service
        sudo systemctl daemon-reload
        sudo systemctl enable jackett
        sudo systemctl start jackett
        
        echo "✅ Jackett installed and started as systemd service"
        ;;
        
    "arch")
        echo "📦 Installing Jackett on Arch Linux..."
        
        # Install from AUR (if yay is available) or manually
        if command -v yay &> /dev/null; then
            yay -S jackett
        elif command -v paru &> /dev/null; then
            paru -S jackett
        else
            echo "⚠️  AUR helper not found. Installing manually..."
            
            # Install dependencies
            sudo pacman -S --needed mono curl wget
            
            # Manual installation
            JACKETT_VERSION=$(curl -s https://api.github.com/repos/Jackett/Jackett/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
            cd /tmp
            wget "https://github.com/Jackett/Jackett/releases/download/$JACKETT_VERSION/Jackett.Binaries.LinuxAMDx64.tar.gz"
            tar -xzf Jackett.Binaries.LinuxAMDx64.tar.gz
            sudo mv Jackett /opt/jackett
            sudo chown -R $USER:$USER /opt/jackett
            
            # Create systemd service (same as Ubuntu)
            sudo tee /etc/systemd/system/jackett.service > /dev/null <<EOF
[Unit]
Description=Jackett Daemon
After=network.target

[Service]
SyslogIdentifier=jackett
Restart=always
RestartSec=5
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/jackett
ExecStart=/opt/jackett/jackett --NoUpdates
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF
            
            sudo systemctl daemon-reload
            sudo systemctl enable jackett
            sudo systemctl start jackett
        fi
        
        echo "✅ Jackett installed and started"
        ;;
        
    "fedora")
        echo "📦 Installing Jackett on Fedora..."
        
        # Install dependencies
        sudo dnf install -y curl wget mono-complete
        
        # Download and install Jackett
        JACKETT_VERSION=$(curl -s https://api.github.com/repos/Jackett/Jackett/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
        cd /tmp
        wget "https://github.com/Jackett/Jackett/releases/download/$JACKETT_VERSION/Jackett.Binaries.LinuxAMDx64.tar.gz"
        tar -xzf Jackett.Binaries.LinuxAMDx64.tar.gz
        sudo mv Jackett /opt/jackett
        sudo chown -R $USER:$USER /opt/jackett
        
        # Create systemd service
        sudo tee /etc/systemd/system/jackett.service > /dev/null <<EOF
[Unit]
Description=Jackett Daemon
After=network.target

[Service]
SyslogIdentifier=jackett
Restart=always
RestartSec=5
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/jackett
ExecStart=/opt/jackett/jackett --NoUpdates
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable jackett
        sudo systemctl start jackett
        
        echo "✅ Jackett installed and started as systemd service"
        ;;
        
    "macos")
        echo "📦 Installing Jackett on macOS..."
        
        if command -v brew &> /dev/null; then
            # Install via Homebrew
            brew install jackett
            
            # Start Jackett service
            brew services start jackett
            
            echo "✅ Jackett installed via Homebrew and started"
        else
            echo "⚠️  Homebrew not found. Please install Homebrew first:"
            echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "   Then run this script again."
            exit 1
        fi
        ;;
        
    *)
        echo "❌ Unsupported OS: $OSTYPE"
        echo ""
        echo "📋 Manual Installation Steps:"
        echo "1. Install Mono runtime for your OS"
        echo "2. Download Jackett from: https://github.com/Jackett/Jackett/releases"
        echo "3. Extract and run: ./jackett"
        echo "4. Access at: http://localhost:9117"
        exit 1
        ;;
esac

# Wait for Jackett to start
echo ""
echo "⏳ Waiting for Jackett to start..."
sleep 10

# Check if Jackett is running
if curl -s http://localhost:9117 > /dev/null; then
    echo ""
    echo "✅ Jackett is now running!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Open http://localhost:9117 in your browser"
    echo "2. Copy the API key from the top-right corner"
    echo "3. Add indexers (torrent sites) in Jackett:"
    echo "   - Click 'Add indexer'"
    echo "   - Search for sites like '1337x', 'RARBG', 'The Pirate Bay'"
    echo "   - Configure each indexer"
    echo "4. Go to HomeFlix Settings → Torrents tab"
    echo "5. Enter Jackett URL: http://localhost:9117"
    echo "6. Enter your API key"
    echo "7. Set download path: ~/Downloads/homeflix"
    echo ""
    echo "🎯 Popular Indexers to Add:"
    echo "   - 1337x"
    echo "   - RARBG"
    echo "   - The Pirate Bay"
    echo "   - YTS"
    echo "   - EZTV"
    echo "   - Torrentz2"
    echo ""
    echo "🔧 Service Management:"
    case $OS in
        "ubuntu"|"arch"|"fedora")
            echo "   - Start:   sudo systemctl start jackett"
            echo "   - Stop:    sudo systemctl stop jackett"
            echo "   - Restart: sudo systemctl restart jackett"
            echo "   - Status:  sudo systemctl status jackett"
            echo "   - Logs:    journalctl -u jackett -f"
            ;;
        "macos")
            echo "   - Start:   brew services start jackett"
            echo "   - Stop:    brew services stop jackett"
            echo "   - Restart: brew services restart jackett"
            ;;
    esac
    echo ""
    echo "⚖️  Legal Notice:"
    echo "   Only download content you legally own or that is in the public domain."
    echo "   Respect copyright laws in your jurisdiction."
else
    echo ""
    echo "❌ Jackett failed to start. Please check the installation."
    echo ""
    echo "🔧 Troubleshooting:"
    case $OS in
        "ubuntu"|"arch"|"fedora")
            echo "   - Check status: sudo systemctl status jackett"
            echo "   - View logs: journalctl -u jackett -f"
            echo "   - Manual start: /opt/jackett/jackett"
            ;;
        "macos")
            echo "   - Check status: brew services list | grep jackett"
            echo "   - Manual start: jackett"
            ;;
    esac
    exit 1
fi