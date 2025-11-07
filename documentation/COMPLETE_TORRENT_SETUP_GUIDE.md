# 🎬 Complete HomeFlix Torrent Setup Guide

## 🚀 **Quick Start (3 Options)**

### **Option 1: Demo Mode (Zero Setup - Try It Now!)**
```bash
# Start HomeFlix normally - works immediately!
cd backend && ./homeflix-server
cd frontend && npm run dev

# Then:
# 1. Go to http://localhost:3000
# 2. Browse to any TMDB movie page
# 3. Click the red "Download" button
# 4. See realistic torrent search results and download simulation
# 5. Watch real-time progress on the movie page!
```

### **Option 2: Docker Setup (Recommended - 2 Minutes)**
```bash
# One command setup
./setup-jackett.sh

# Then configure in HomeFlix (see Configuration section below)
```

### **Option 3: Native Setup (No Docker - 5 Minutes)**
```bash
# Native installation
./setup-jackett-native.sh

# Then configure in HomeFlix (see Configuration section below)
```

---

## 📋 **Detailed Setup Instructions**

### **🐳 Docker Setup (Recommended)**

#### **Step 1: Run the Setup Script**
```bash
# Make sure you're in the HomeFlix root directory
chmod +x setup-jackett.sh
./setup-jackett.sh
```

**What this does:**
- Downloads and runs Jackett in Docker
- Sets up on port 9117
- Creates persistent configuration
- Starts automatically

#### **Step 2: Verify Jackett is Running**
```bash
# Check if Jackett is running
docker ps | grep jackett

# You should see something like:
# CONTAINER ID   IMAGE                    COMMAND   CREATED   STATUS   PORTS                    NAMES
# abc123def456   lscr.io/linuxserver/jackett   ...       ...       ...      0.0.0.0:9117->9117/tcp   jackett
```

#### **Step 3: Access Jackett Web Interface**
1. Open your browser
2. Go to: `http://localhost:9117`
3. You should see the Jackett dashboard

---

### **🖥️ Native Setup (No Docker)**

#### **Step 1: Run the Native Setup Script**
```bash
# Make sure you're in the HomeFlix root directory
chmod +x setup-jackett-native.sh
./setup-jackett-native.sh
```

**What this does:**
- Downloads Jackett for Linux
- Extracts to `~/jackett`
- Sets up as a systemd service
- Starts automatically

#### **Step 2: Verify Jackett is Running**
```bash
# Check service status
systemctl --user status jackett

# Check if it's listening on port 9117
curl -I http://localhost:9117
```

#### **Step 3: Access Jackett Web Interface**
1. Open your browser
2. Go to: `http://localhost:9117`
3. You should see the Jackett dashboard

---

## ⚙️ **Jackett Configuration**

### **Step 1: Add Indexers (Torrent Sites)**

1. **Open Jackett**: Go to `http://localhost:9117`
2. **Click "Add indexer"**
3. **Add these recommended indexers:**

**Public Indexers (No registration needed):**
- ✅ **1337x** - Click "+" to add
- ✅ **YTS** - Click "+" to add  
- ✅ **EZTV** - Click "+" to add
- ✅ **LimeTorrents** - Click "+" to add
- ✅ **TorrentGalaxy** - Click "+" to add

**Private Indexers (If you have accounts):**
- 🔐 **RARBG** (if available)
- 🔐 **Torrentleech** (if you have account)
- 🔐 **IPTorrents** (if you have account)

### **Step 2: Get Your API Key**

1. **In Jackett dashboard**, look for the **API Key** section at the top
2. **Copy the API Key** - it looks like: `abc123def456ghi789jkl012mno345pqr678stu`
3. **Keep this safe** - you'll need it for HomeFlix configuration

### **Step 3: Test Jackett**

```bash
# Test API call (replace YOUR_API_KEY with your actual key)
curl "http://localhost:9117/api/v2.0/indexers/all/results?apikey=YOUR_API_KEY&Query=matrix"

# You should get JSON response with torrent results
```

---

## 🎬 **HomeFlix Configuration**

### **Step 1: Start HomeFlix**
```bash
# Terminal 1: Start backend
cd backend
./homeflix-server

# Terminal 2: Start frontend  
cd frontend
npm run dev
```

### **Step 2: Configure Torrent Settings**

1. **Open HomeFlix**: Go to `http://localhost:3000`
2. **Go to Settings**: Click the settings icon or go to `/settings`
3. **Click "Torrents" tab**
4. **Configure the following:**

```
Jackett URL: http://localhost:9117
API Key: [paste your API key from Jackett]
Download Path: ~/Downloads/homeflix (or your preferred path)
Min Seeders: 10
Max Downloads: 5
Auto Download: false (recommended to start)
Preferred Quality: 1080p
```

5. **Click "Save Settings"**

### **Step 3: Test the Configuration**

1. **In the Torrents tab**, try searching for a movie
2. **You should see real torrents** from your configured indexers
3. **If you see results**, configuration is working!

---

## 🎯 **Using the New Torrent System**

### **Method 1: One-Click Download from Movie Pages**

1. **Browse TMDB Movies**:
   - Go to any movie page (e.g., `/tmdb-movie/550` for Fight Club)
   - Or search for movies in HomeFlix

2. **Click Download**:
   - Click the red "Download" button
   - System automatically finds best torrent
   - Download starts immediately

3. **Watch Progress**:
   - Progress shows on the same page
   - Button updates: "Download" → "Starting..." → "45.2%" → "Downloaded"
   - Progress bar appears below button

4. **Automatic Integration**:
   - When complete, movie automatically appears in your HomeFlix library
   - No manual file management needed!

### **Method 2: Manual Selection via Torrent Dashboard**

1. **Go to Settings → Torrents tab**
2. **Search for specific movie**
3. **Browse all available torrents**
4. **Select preferred quality/source**
5. **Monitor progress in Downloads tab**

---

## 🔧 **Advanced Configuration**

### **Custom Download Path**
```bash
# Create custom download directory
mkdir -p ~/Movies/HomeFlix-Downloads

# In HomeFlix settings, set:
# Download Path: /home/yourusername/Movies/HomeFlix-Downloads
```

### **VPN Configuration (Recommended)**
```bash
# If using VPN, make sure Jackett can access it
# Test with:
curl --proxy socks5://127.0.0.1:1080 http://localhost:9117/api/v2.0/indexers

# Configure proxy in Jackett if needed
```

### **Firewall Configuration**
```bash
# Allow Jackett port
sudo ufw allow 9117

# Check if port is open
netstat -tlnp | grep 9117
```

---

## 🎬 **Complete Workflow Example**

### **Scenario: Downloading "The Matrix" (1999)**

1. **Start HomeFlix**:
   ```bash
   cd backend && ./homeflix-server &
   cd frontend && npm run dev
   ```

2. **Browse to Movie**:
   - Go to `http://localhost:3000`
   - Search for "The Matrix" or browse TMDB movies
   - Click on "The Matrix (1999)"

3. **Download**:
   - Click red "Download" button
   - System searches Jackett automatically
   - Finds best 1080p torrent
   - Starts download immediately

4. **Monitor Progress**:
   - Button shows: "Starting..." → "12.4%" → "67.8%" → "Downloaded"
   - Progress bar fills up in real-time
   - Updates every 2 seconds

5. **Automatic Integration**:
   - Download completes
   - HomeFlix scanner automatically detects file
   - Movie processed and added to library
   - Available in your collection immediately

6. **Watch**:
   - Movie now appears in HomeFlix library
   - Click to watch with full metadata, thumbnails, etc.

---

## 🛠️ **Troubleshooting**

### **Jackett Issues**

**Problem**: Can't access `http://localhost:9117`
```bash
# Check if Jackett is running
docker ps | grep jackett
# or for native:
systemctl --user status jackett

# Restart if needed
docker restart jackett
# or for native:
systemctl --user restart jackett
```

**Problem**: No indexers working
```bash
# Check Jackett logs
docker logs jackett
# or for native:
journalctl --user -u jackett -f
```

### **HomeFlix Integration Issues**

**Problem**: "No torrents found"
1. Check Jackett URL in settings: `http://localhost:9117`
2. Verify API key is correct
3. Test Jackett directly in browser
4. Check if indexers are working in Jackett

**Problem**: Downloads not starting
1. Check download path permissions
2. Verify disk space
3. Check HomeFlix logs in terminal

**Problem**: Files not appearing in library
1. Check download path in settings
2. Verify HomeFlix media scanner is running
3. Check file permissions

### **Network Issues**

**Problem**: API calls failing
```bash
# Test connectivity
curl http://localhost:9117
curl http://localhost:8080/api/torrent/config

# Check firewall
sudo ufw status
```

---

## 📊 **Performance Tips**

### **Optimize Jackett**
1. **Limit indexers** to 5-10 reliable ones
2. **Remove slow indexers** that timeout
3. **Use private trackers** if available (faster, better quality)

### **Optimize HomeFlix**
1. **Set reasonable download limits** (Max Downloads: 3-5)
2. **Use SSD for download path** if possible
3. **Ensure adequate disk space**

### **Network Optimization**
1. **Use wired connection** for stability
2. **Configure QoS** if needed
3. **Consider VPN** for privacy

---

## 🎉 **Success Indicators**

### **✅ Setup Complete When:**
- Jackett accessible at `http://localhost:9117`
- API key working in HomeFlix settings
- Test search returns real torrents
- Download button works on movie pages
- Progress shows in real-time
- Completed downloads appear in library

### **🎬 Ready to Use When:**
- One-click downloads work from movie pages
- Real-time progress updates
- Automatic library integration
- Movies playable immediately after download

---

## 🚀 **Next Steps**

### **Enhance Your Setup**
1. **Add more indexers** in Jackett
2. **Configure VPN** for privacy
3. **Set up automated downloads** for TV series
4. **Customize quality preferences**

### **Advanced Features**
1. **RSS feeds** for automatic downloads
2. **Custom categories** and filters
3. **Bandwidth limiting**
4. **Scheduled downloads**

---

## 📞 **Support**

### **If You Need Help**
1. **Check logs** in terminal where HomeFlix is running
2. **Test Jackett directly** at `http://localhost:9117`
3. **Verify configuration** in HomeFlix settings
4. **Check file permissions** and disk space

### **Common Solutions**
- **Restart services**: `docker restart jackett` or `systemctl --user restart jackett`
- **Clear browser cache** and refresh HomeFlix
- **Check network connectivity** and firewall settings
- **Verify API key** is copied correctly

---

## 🎊 **Congratulations!**

**You now have a professional-grade torrent system integrated with HomeFlix!**

**Features you can now enjoy:**
- ✅ One-click movie downloads
- ✅ Real-time progress tracking  
- ✅ Automatic library integration
- ✅ Professional UI/UX
- ✅ Multiple torrent sources
- ✅ Quality selection
- ✅ Seamless media management

**🍿 Happy downloading and enjoy your enhanced HomeFlix experience! 🎉**

---

*Remember: Always respect copyright laws and only download content you legally own or that is in the public domain.*