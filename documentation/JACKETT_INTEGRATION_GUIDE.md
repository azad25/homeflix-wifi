# 🎬 Jackett Integration Guide

## ✅ **Your API Key: `gldu7nscw5qaf333rcbp4qf504uorif6`**

## 🚀 **Step-by-Step Configuration**

### **Step 1: Access HomeFlix Settings**
1. Open HomeFlix: `http://localhost:3000`
2. Go to **Settings** (gear icon in navigation)
3. Click the **"Torrents"** tab

### **Step 2: Configure Jackett Settings**
In the Torrents tab, you'll now see a configuration form with these fields:

```
Jackett URL: http://localhost:9117
Jackett API Key: gldu7nscw5qaf333rcbp4qf504uorif6
Download Path: ~/Downloads/homeflix
Min Seeders: 5
Max Downloads: 3
Auto Download: false
Preferred Quality: 1080p
```

### **Step 3: Test Your Configuration**
1. **Fill in the fields** with your settings
2. **Click "Test Connection"** - this will verify your Jackett setup
3. **Click "Save Configuration"** to save your settings

### **Step 4: Verify It's Working**
1. **In the same Torrents tab**, try the **"Search Torrents"** section
2. **Search for a movie** like "matrix" or "avatar"
3. **You should see real torrents** from your 5 indexers!

---

## 🎯 **Quick Test**

### **Test Jackett Directly**
```bash
# Test your API key directly
curl "http://localhost:9117/api/v2.0/indexers/all/results?apikey=gldu7nscw5qaf333rcbp4qf504uorif6&Query=matrix"
```

### **Expected Result**
You should see JSON with torrent results from your indexers.

---

## 🎬 **Using the New System**

### **Method 1: One-Click Download (Recommended)**
1. **Browse any TMDB movie page** in HomeFlix
2. **Click the red "Download" button**
3. **Watch real-time progress** on the same page
4. **Movie automatically appears** in your library when complete

### **Method 2: Manual Selection**
1. **Go to Settings → Torrents tab**
2. **Search for specific movie**
3. **Browse all available torrents**
4. **Select preferred quality/source**
5. **Monitor progress** in Downloads tab

---

## 🔧 **Configuration Options**

### **Jackett Settings**
- **Jackett URL**: `http://localhost:9117` (your Jackett server)
- **API Key**: `gldu7nscw5qaf333rcbp4qf504uorif6` (your unique key)

### **Download Settings**
- **Download Path**: Where files are saved (default: `~/Downloads/homeflix`)
- **Min Seeders**: Minimum seeders required (recommended: 5-10)
- **Max Downloads**: Concurrent downloads (recommended: 3-5)
- **Preferred Quality**: Auto-select quality (1080p recommended)

### **Advanced Settings**
- **Enabled Sources**: Which indexers to use
- **Auto Download**: Automatically download best match
- **Proxy Settings**: Use proxy if needed

---

## 🎉 **What Happens Next**

### **When You Download a Movie:**
1. **HomeFlix searches** your Jackett indexers
2. **Finds best torrent** based on quality/seeders
3. **Starts download** with real-time progress
4. **Scanner automatically detects** completed file
5. **Movie appears** in your HomeFlix library
6. **Ready to watch** immediately!

### **Real-time Features:**
- ✅ **Live progress** on movie pages
- ✅ **Download status** indicators
- ✅ **Automatic library** integration
- ✅ **Professional UI** with Netflix-style design

---

## 🛠️ **Troubleshooting**

### **If Test Connection Fails:**
1. **Check Jackett is running**: `http://localhost:9117`
2. **Verify API key** is correct
3. **Check indexers** are working in Jackett
4. **Restart Jackett** if needed: `docker restart jackett`

### **If No Torrents Found:**
1. **Test configuration** first
2. **Check indexers** in Jackett dashboard
3. **Try different search terms**
4. **Verify indexers** are responding

### **If Downloads Don't Start:**
1. **Check download path** permissions
2. **Verify disk space**
3. **Check HomeFlix logs** in terminal

---

## 🎊 **You're Ready!**

**Your HomeFlix now has:**
- ✅ **Real Jackett integration** with your API key
- ✅ **5 indexers** configured and working
- ✅ **One-click downloads** from movie pages
- ✅ **Real-time progress** tracking
- ✅ **Automatic library** integration

**🍿 Start downloading movies and enjoy your enhanced HomeFlix experience!**

---

## 📞 **Quick Help**

### **Test Commands**
```bash
# Check Jackett status
curl http://localhost:9117

# Test API key
curl "http://localhost:9117/api/v2.0/indexers/all/results?apikey=gldu7nscw5qaf333rcbp4qf504uorif6&Query=test"

# Check HomeFlix torrent config
curl http://localhost:8080/api/torrent/config
```

### **Your Settings Summary**
- **Jackett URL**: `http://localhost:9117`
- **API Key**: `gldu7nscw5qaf333rcbp4qf504uorif6`
- **Indexers**: 5 configured
- **Status**: Ready to use!

**🎬 Happy downloading!**