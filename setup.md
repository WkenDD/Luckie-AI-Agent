# 📋 Panduan Setup Detail - Luckie AI Discord Bot

Panduan lengkap untuk setup bot Discord AI customer service dari awal sampai running.

---

## 🔑 Step 1: Persiapan Discord Bot

### 1.1 Buat Application di Discord Developer Portal
1. Kunjungi [Discord Developer Portal](https://discord.com/developers/applications)
2. Klik **"New Application"**
3. Beri nama aplikasi (contoh: "Luckie AI Bot")
4. Klik **"Create"**

### 1.2 Setup Bot
1. Di sidebar kiri, klik **"Bot"**
2. Klik **"Add Bot"** → **"Yes, do it!"**
3. **SIMPAN TOKEN** (klik "Copy" di bagian Token)
4. Scroll ke bawah ke **"Privileged Gateway Intents"**
5. ✅ Aktifkan **"MESSAGE CONTENT INTENT"**
6. ✅ Aktifkan **"SERVER MEMBERS INTENT"**
7. Klik **"Save Changes"**

### 1.3 Invite Bot ke Server
1. Di sidebar kiri, klik **"OAuth2"** → **"URL Generator"**
2. Centang **"bot"** di bagian Scopes
3. Centang permissions berikut di Bot Permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Manage Messages (opsional)
4. Copy URL yang dihasilkan dan buka di browser
5. Pilih server dan klik **"Authorize"**

---

## 🤖 Step 2: Setup Google Gemini AI

### 2.1 Dapatkan API Key
1. Kunjungi [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Login dengan akun Google
3. Klik **"Create API Key"**
4. **SIMPAN API KEY** yang dihasilkan

### 2.2 Test API Key (Opsional)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
```

---

## 🏗️ Step 3: Setup Project

### 3.1 Clone & Install Dependencies
```bash
# Clone repository
git clone https://github.com/yourusername/luckie-ai-discord-bot.git
cd luckie-ai-discord-bot

# Install dependencies
npm install
```

### 3.2 Setup Environment Variables
```bash
# Copy template
cp env.txt .env

# Edit file .env
nano .env  # atau menggunakan editor lain
```

Isi file `.env`:
```env
DISCORD_TOKEN=TOKEN_DISCORD
GEMINI_API_KEY=API_KEY_GEMINI
TICKET_CATEGORY_ID=1234567890123456789
COMMAND_PREFIX=!sk # bebas ubah. default !sk
```

---

## 🎯 Step 4: Setup Discord Server

### 4.1 Buat Kategori Tiket
1. Di Discord server, klik kanan pada channel list
2. Pilih **"Create Category"**
3. Beri nama (contoh: "🎫 Customer Support")
4. Klik kanan kategori → **"Copy ID"** (pastikan Developer Mode aktif)
5. Paste ID ini ke `TICKET_CATEGORY_ID` di file `.env`

### 4.2 Buat Channel Tiket
1. Di dalam kategori, buat channel text (contoh: "#tiket-001")
2. Bot akan otomatis merespons di channel dalam kategori ini

---

## 📊 Step 5: Konfigurasi Data Stok

### 5.1 Edit dataStock.json
Sesuaikan file `dataStock.json` dengan data hosting Anda:

```json
{
  "categories": {
    "MINECRAFT": {
      "summary": [
        {
          "tingkat": "ENHANCE",
          "ram": "4GB",
          "storage": "156GB",
          "is_available": true
        }
      ],
      "detail": {
        "ENHANCE": {
          "type": "MINECRAFT",
          "description": "Hosting Minecraft paket ENHANCE",
          "plans": {
            "1": {
              "price": 7000,
              "ram": "1GB",
              "storage": "45GB",
              "cpu": "200%",
              "bandwidth": "UNLIMITED",
              "location": "WEST JAVA"
            }
          }
        }
      }
    }
  }
}
```

### 5.2 Kustomisasi AI Template
Edit `luckie-template.txt` untuk menyesuaikan personality bot:

```
Kamu adalah **Luckie**, AI customer service dari **ExtremesID**.

Tugasmu adalah membantu customer seputar layanan hosting...
```

---

## 🚀 Step 6: Menjalankan Bot

### 6.1 Test Run
```bash
# Jalankan sekali untuk test
npm start
```

Jika berhasil, akan muncul:
```
Logged in as LuckieBot#1234!
Status AI pause berhasil dimuat.
```

### 6.2 Production Setup dengan PM2
```bash
# Install PM2 globally
npm install -g pm2

# Jalankan dengan PM2
pm2 start index.js --name "luckie-bot"

# Auto restart saat server reboot
pm2 startup
pm2 save
```

---

## ✅ Step 7: Testing Bot

### 7.1 Test Basic Function
Di channel tiket, ketik:
```
Halo, ada paket hosting minecraft?
```

Bot harus merespons dengan informasi paket.

### 7.2 Test Admin Commands
```
!sk control                          # Lihat status AI
!sk control ai-stop #tiket-001      # Pause AI
!sk control ai-play #tiket-001      # Resume AI
```

### 7.3 Test Intent Detection
```
harga minecraft enhance 2gb         # Test price inquiry
list paket                          # Test package listing
mau beli hosting                     # Test buy intent
kontak admin                         # Test contact intent
```

---

## 🔧 Troubleshooting

### Bot Tidak Online
- ✅ Cek token Discord di `.env`
- ✅ Pastikan bot sudah di-invite ke server
- ✅ Cek internet connection

### Bot Tidak Merespons
- ✅ Pastikan MESSAGE_CONTENT_INTENT aktif
- ✅ Cek bot ada permission di channel
- ✅ Pastikan channel ada di kategori yang benar

### Error Gemini API
- ✅ Cek API key Gemini valid
- ✅ Cek quota API (gratis ada limit)
- ✅ Cek koneksi internet

### Error File Not Found
- ✅ Pastikan `dataStock.json` dan `luckie-template.txt` ada
- ✅ Cek permission file system
- ✅ Pastikan format JSON valid

---

## 🔄 Maintenance

### Update Data Stok
1. Edit `dataStock.json`
2. Bot akan otomatis load ulang data

### Backup Important Files
```bash
# Files yang perlu di-backup
cp .env .env.backup
cp dataStock.json dataStock.json.backup
cp ai_pause_status.json ai_pause_status.json.backup
```

### Monitor Logs
```bash
# Jika menggunakan PM2
pm2 logs luckie-bot

# Atau langsung
npm start
```

---

## 🚨 Security Checklist

- ⚠️ **JANGAN** commit file `.env` ke Git
- ⚠️ **JANGAN** share token Discord atau API key
- ✅ Gunakan .gitignore untuk exclude sensitive files
- ✅ Rotate API keys secara berkala
- ✅ Monitor penggunaan API quota

---

## 📞 Butuh Bantuan?

Jika mengalami masalah saat setup:

1. 🐛 [Discussion](https://discord.gg/y4WujNeHvf)
2. 📧 Email: sankuhhh@gmai.com

---

<div align="center">
<strong>Sanku Studio</strong>
</div>

<div align="center">
<em>Emerge. Evolve. Excel.</em>
</div>