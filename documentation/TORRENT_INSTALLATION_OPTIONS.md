# 🎬 HomeFlix Torrent Installation Options

## 🚀 **Three Ways to Set Up Torrents**

### 1. **🐳 Docker Installation** (Recommended - Easiest)
```bash
./setup-jackett.sh
```
**Pros:**
- ✅ One command setup
- ✅ Automatic updates
- ✅ Isolated environment
- ✅ Easy to remove

**Cons:**
- ❌ Requires Docker

---

### 2. **💻 Native Installation** (No Docker Required)
```bash
./setup-jackett-native.sh
```
**Pros:**
- ✅ No Docker dependency
- ✅ Direct system integration
- ✅ Better performance
- ✅ Systemd service management

**Cons:**
- ❌ OS-specific setup
- ❌ Manual dependency management

---

### 3. **🎭 Demo Mode** (No Setup Required)
```bash
# Just start HomeFlix - torrents work with mock data
cd backend && ./homeflix-server
cd frontend && npm run dev
```
**Pros:**
- ✅ Zero setup required
- ✅ Instant demo
- ✅ Perfect for testing UI
- ✅ No external dependencies

**Cons:**
- ❌ Mock data only
- ❌ No real downloads

---

## 📋 **Detailed Installation Guides**

### 🐳 **Option 1: Docker Setup**

#### Prerequisites
- Docker and Docker Compose

#### Installation
```bash
# Run the setup script
./setup-jackett.sh

# Or manually:
docker-compose -f docker-compose.jackett.yml up -d
```

#### Management
```bash
# Start
docker-compose -f docker-compose.jackett.yml up -d

# Stop
docker-compose -f docker-compose.jackett.yml down

# Logs
docker-compose -f docker-compose.jackett.yml logs -f

# Restart
docker-compose -f docker-compose.jackett.yml restart
```

---

### 💻 **Option 2: Native Setup**

#### Ubuntu/Debian
```bash
# Automatic
./setup-jackett-native.sh

# Manual
sudo apt update
sudo apt install mono-complete curl wget
wget https://github.com/Jackett/Jackett/releases/latest/download/Jackett.Binaries.LinuxAMDx64.tar.gz
tar -xzf Jackett.Binaries.LinuxAMDx64.tar.gz
sudo mv Jackett /opt/jackett
sudo systemctl enable jackett
sudo systemctl start jackett
```

#### Arch Linux
```bash
# With AUR helper
yay -S jackett
# or
paru -S jackett

# Manual
./setup-jackett-native.sh
```

#### macOS
```bash
# With Homebrew
brew install jackett
brew services start jackett

# Manual
./setup-jackett-native.sh
```

#### Windows
1. Download Jackett from [GitHub releases](https://github.com/Jackett/Jackett/releases)
2. Extract and run `JackettConsole.exe`
3. Install as Windows service (optional)

---

### 🎭 **Option 3: Demo Mode**

#### No Setup Required!
1. Start HomeFlix normally
2. Go to any TMDB movie page
3. Click "Download" button
4. See realistic mock torrent results
5. Test the complete UI workflow

#### Features Available
- ✅ Search interface with quality filtering
- ✅ Download progress simulation
- ✅ Pause/Resume/Remove controls
- ✅ Settings configuration
- ✅ Complete UI/UX experience

---

## ⚙️ **Configuration (All Methods)**

### 1. **Access Jackett** (Options 1 & 2 only)
- Open: http://localhost:9117
- Copy API key from top-right corner

### 2. **Add Indexers** (Options 1 & 2 only)
Popular indexers to add:
- **1337x** - General purpose, reliable
- **RARBG** - High quality releases
- **The Pirate Bay** - Largest selection
- **YTS** - Movies, smaller files
- **EZTV** - TV shows specialist
- **LimeTorrents** - Good backup option

### 3. **Configure HomeFlix**
1. Go to Settings → Torrents tab
2. Enter configuration:
   - **Jackett URL**: `http://localhost:9117` (or leave empty for demo)
   - **API Key**: (from Jackett, or leave empty for demo)
   - **Download Path**: `~/Downloads/homeflix`
   - **Min Seeders**: `10`
   - **Preferred Quality**: `1080p`

---

## 🔄 **Switching Between Modes**

### From Demo to Real Torrents
1. Run setup script: `./setup-jackett.sh` or `./setup-jackett-native.sh`
2. Configure API key in HomeFlix settings
3. Add indexers in Jackett
4. Start downloading real torrents!

### From Real to Demo
1. Clear API key in HomeFlix settings
2. System automatically falls back to demo mode

### From Docker to Native
1. Stop Docker: `docker-compose -f docker-compose.jackett.yml down`
2. Run native setup: `./setup-jackett-native.sh`
3. Update HomeFlix settings if needed

---

## 🎯 **Which Option Should You Choose?**

### **Choose Docker If:**
- ✅ You have Docker installed
- ✅ You want the easiest setup
- ✅ You prefer isolated applications
- ✅ You want automatic updates

### **Choose Native If:**
- ✅ You don't want Docker
- ✅ You prefer system integration
- ✅ You want maximum performance
- ✅ You're comfortable with system services

### **Choose Demo If:**
- ✅ You just want to test the feature
- ✅ You're developing/customizing
- ✅ You don't need real downloads yet
- ✅ You want zero setup time

---

## 🛠️ **Troubleshooting**

### **Common Issues**

#### Jackett Not Starting
```bash
# Check if port 9117 is in use
sudo netstat -tlnp | grep 9117

# Kill conflicting process
sudo kill -9 <PID>

# Restart Jackett
sudo systemctl restart jackett  # Native
# or
docker-compose -f docker-compose.jackett.yml restart  # Docker
```

#### No Search Results
1. Check if Jackett is running: http://localhost:9117
2. Test indexers in Jackett interface
3. Verify API key in HomeFlix settings
4. Check minimum seeders setting

#### Downloads Not Starting
1. Verify download path exists and is writable
2. Check disk space
3. Ensure torrent client is running
4. Check firewall settings

### **Getting Help**
1. Check Jackett logs
2. Check HomeFlix backend logs
3. Test API endpoints manually
4. Verify network connectivity

---

## 📊 **Feature Comparison**

| Feature | Docker | Native | Demo |
|---------|--------|--------|------|
| Setup Time | 2 min | 5 min | 0 min |
| Real Downloads | ✅ | ✅ | ❌ |
| UI Testing | ✅ | ✅ | ✅ |
| Auto Updates | ✅ | ❌ | N/A |
| System Integration | ❌ | ✅ | N/A |
| Resource Usage | Medium | Low | Minimal |
| Isolation | ✅ | ❌ | N/A |

---

## 🎉 **Quick Start Recommendations**

### **For Testing/Demo:**
```bash
# Just start HomeFlix - no setup needed!
cd backend && ./homeflix-server
cd frontend && npm run dev
# Go to any movie page and click "Download"
```

### **For Production Use:**
```bash
# If you have Docker:
./setup-jackett.sh

# If you don't have Docker:
./setup-jackett-native.sh

# Then configure in HomeFlix Settings → Torrents
```

**🎬 Choose your adventure and start downloading! 🍿**