# 🤖 Luckie AI - Discord Customer Service Bot

[![Version](https://img.shields.io/badge/version-1.3-purple.svg)](https://github.com/wkendd/luckie-ai-discord-bot)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-16.0+-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-14.0+-7289da.svg)](https://discord.js.org/)

**Luckie AI** adalah bot Discord berbasis AI yang dirancang khusus untuk customer service layanan hosting. Bot ini menggunakan Google Gemini AI untuk memberikan respons yang cerdas dan akurat tentang informasi hosting, harga, stok, dan bantuan pelanggan.

## ✨ Fitur Utama

🧠 **AI-Powered Customer Service**
- Respons otomatis menggunakan Google Gemini 2.5 Flash
- Analisis intent pengguna untuk memberikan jawaban yang tepat
- Dukungan percakapan kontekstual

📊 **Manajemen Stok & Harga**
- Monitoring stok hosting real-time dari file JSON
- Kalkulasi harga otomatis berdasarkan spesifikasi
- Dukungan multiple kategori hosting (Minecraft, VPS, Website)

⚙️ **Kontrol Admin**
- Pause/resume AI per channel
- Command system dengan prefix yang dapat dikustomisasi
- Status monitoring untuk semua channel tiket

 🎯 **Deteksi Intent Cerdas**
- Otomatis mendeteksi maksud pengguna (beli, tanya harga, kontak, dll)
- Respons khusus untuk pertanyaan spesifik
- Format jawaban yang konsisten dan profesional

---

# 🚀 Quick Start

Persyaratan Sistem
- Node.js 16.0 atau lebih tinggi
- NPM atau Yarn
- Discord Bot Token
- Google Gemini API Key

### 1. Clone Repository
```bash
git clone https://github.com/wkendd/luckie-ai-discord-bot.git
cd luckie-ai-discord-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment
Salin file `env.txt` menjadi `.env` dan isi dengan data Anda:
```bash
cp env.txt .env
```

Edit file `.env`:
```env
DISCORD_TOKEN=your_discord_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
TICKET_CATEGORY_ID=your_ticket_category_id_here
COMMAND_PREFIX=!sk
```

### 4. Setup Data Stok
Sesuaikan file `dataStock.json` dengan data hosting Anda.

### 5. Kustomisasi AI Template
Edit `luckie-template.txt` untuk menyesuaikan personality dan response AI.

### 6. Jalankan Bot
```bash
npm start
```

---

## 📁 Struktur Project

```
luckie-ai-discord-bot/
├── index.js                 # File utama bot
├── package.json             # Dependencies dan scripts
├── .env                     # Environment variables (JANGAN COMMIT!)
├── env.txt                  # Template environment variables
├── luckie-template.txt      # Template prompt AI
├── dataStock.json          # Data harga dan stok hosting
├── ai_pause_status.json    # Status pause AI (auto-generated)
└── README.md               # Dokumentasi ini
```

---

## ⚙️ Konfigurasi

### Environment Variables

| Variable | Deskripsi | Required |
|----------|-----------|----------|
| `DISCORD_TOKEN` | Token bot Discord Anda | ✅ |
| `GEMINI_API_KEY` | API key Google Gemini | ✅ |
| `TICKET_CATEGORY_ID` | ID kategori channel tiket | ✅ |
| `COMMAND_PREFIX` | Prefix untuk command admin | ❌ (default: `!sk`) |

### Discord Bot Permissions
Bot memerlukan permissions berikut:
- `Read Messages/View Channels`
- `Send Messages`
- `Read Message History`
- `Use Slash Commands` (opsional)

### Discord Developer Portal Settings
Pastikan untuk mengaktifkan:
- ✅ **Message Content Intent**
- ✅ **Server Members Intent**

---

## 🎮 Command Admin

| Command | Deskripsi | Permission |
|---------|-----------|------------|
| `!sk control` | Tampilkan status AI semua channel | Administrator |
| `!sk control ai-stop #channel` | Pause AI di channel tertentu | Administrator |
| `!sk control ai-play #channel` | Resume AI di channel tertentu | Administrator |

### Contoh Penggunaan:
```
!sk control                           # Lihat status semua channel
!sk control ai-stop <#tiket-001>      # Pause AI di channel tiket-001
!sk control ai-play <#tiket-001>      # Resume AI di channel tiket-001
```

---

## 🗃️ Format Data Stok

File `dataStock.json` menggunakan struktur sebagai berikut:

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

---

# 🤖 Cara Kerja AI

### 1. **Intent Analysis**
Bot menganalisis pesan pengguna untuk menentukan intent:
- `list_packages` - Minta daftar paket
- `buy` - Ingin membeli
- `contact` - Minta kontak
- `price_spec` - Tanya harga spesifik
- `general` - Pertanyaan umum

### 2. **Response Generation**
- **Intent Spesifik**: Menggunakan template respons terstruktur
- **Pertanyaan Umum**: Diteruskan ke Gemini AI dengan context

### 3. **Stock Validation**
- Cek ketersediaan real-time dari `dataStock.json`
- Validasi RAM minimum 2GB untuk availability
- Kalkulasi harga otomatis berdasarkan spesifikasi

---

## 🔧 Troubleshooting

 **Bot Tidak Merespons**
- ✅ Pastikan bot online di Discord
- ✅ Cek `MESSAGE_CONTENT_INTENT` sudah aktif
- ✅ Pastikan bot ada di kategori channel yang benar
- ✅ Cek AI tidak dalam status pause

**Error API Gemini**
- ✅ Pastikan API key valid
- ✅ Cek quota API Gemini
- ✅ Pastikan koneksi internet stabil

### Error File Not Found
1. ✅ Pastikan semua file ada (dataStock.json, luckie-template.txt)
2. ✅ Cek permission file system
3. ✅ Pastikan path file benar

---

## 🔒 Keamanan

**⚠️ PENTING - Jangan Commit File Sensitive!**
```bash
# Tambahkan ke .gitignore
.env
ai_pause_status.json
node_modules/
*.log
```

**Best Practices:**
- Simpan token dan API key di environment variables
- Gunakan role-based permissions untuk command admin
- Monitor penggunaan API secara berkala


---


## 📄 License

Project ini dilisensikan under MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

## 📝 Changelog
*Luckie v1.3-privier (2025-06-25)*

- 🛠️ Perbaikan masalah pembacaan file dataStock.json untuk memastikan akses data yang lebih akurat.
- 🧠 Peningkatan Pemahaman AI, Optimalisasi pemrosesan bahasa AI untuk memahami kata-per-kata dengan lebih akurat, memberikan respons yang lebih alami.
- ⏯️ Fitur Pause/Play AI Chat: Menambahkan fungsi pause dan play untuk obrolan AI di channel

---


## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Library Discord yang powerful
- [Google Generative AI](https://ai.google.dev/) - AI engine yang cerdas
- [Node.js](https://nodejs.org/) - Runtime environment
 
---

## 📞 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

- 🐛 **Bug Reports**: [Issues](https://discord.gg/y4WujNeHvf)
- 💬 **Discussions**: [Discussions](https://discord.gg/y4WujNeHvf)
- 📧 **Email**: sankuhhh@gmail.com

---

<div align="center">
<strong>Sanku Studio</strong>
</div>

<div align="center">
<em>Emerge. Evolve. Excel.</em>
</div>

