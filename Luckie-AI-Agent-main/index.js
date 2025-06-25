// ================================ //
// ==  BOT DISCORD SANKU STUDIO  == //
// ==  Luckie AI + Stock System  == //
// ================================ //
//
// ------------ Catatan -----------
// Ini file utama `index.js` buat bot Discord AI agent nya.

// - AI berbasis Gemini buat jawab chat customer
// ( AI bebas pake model apa aja, tapi saran gemini-2.5-flash karena jawabnya cepet)
// - Sistem parsing user (beli, tanya, dll)
// - Deteksi stock hosting dari file JSON "dataStock.json"
// - Ajarin AI buar ga terlalu tolol "luckie-template.txt"
// - Perintah admin buat nyalain/matiin AI di tiap channel yang masuk dalam category .env "!sk control"
//
// TOLONG JANGAN HAPUS ATAU UBAH KODE KECUALI UDAH NGERTI!!
// ==========================================

// === IMPORT YANG HARUS ADA DI ATAS ===
// Kalo ada yang kurang, bot lu bisa error atau gak jalan.
require("dotenv").config(); // Ini buat baca file `.env`, isinya token bot sama API key Gemini. JANGAN SAMPE KETAHUAN ORANG LAIN!
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} = require("discord.js"); // Ini library utama Discord.js. Buat ngidupin bot, nanggepin pesan, dll.
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises; // Ini buat baca/tulis file secara async (gak bikin bot nge-freeze). Penting buat baca stok sama status AI.
const path = require("path"); // Ini buat ngatur path file lokal, biar gak pusing beda OS (Windows/Linux).

// === KONFIGURASI DASAR YANG DIPAKE DI SELURUH BOT ===
// Bagian ini kayak setelan awal bot lu. Kalo mau ganti-ganti, di sini tempatnya.
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Token bot Discord lu, ngambilnya dari file .env.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // API key Gemini lu, juga dari .env.
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID; // ID kategori Discord tempat channel tiket lu dibuat. Contoh: "123456789012345678"
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || "!sk"; // Prefix buat command admin, defaultnya `!sk`. Kalo mau ganti jadi `!agus`, `!bakekok` juga bisa.
const TEMPLATE_PATH = path.join(__dirname, "luckie-template.txt"); // Path ke file template prompt buat AI. Ini buat ngajarin Luckie biar gak TOLOL amat.

// === CLIENT BOT DISCORD ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Biar bot bisa lihat server (guild) lu.
    GatewayIntentBits.GuildMessages, // Biar bot bisa baca pesan di server.
    GatewayIntentBits.MessageContent, // WAJIB aktifin ini di Developer Portal Discord! Kalo nggak, bot lu gak bisa baca isi pesan.
    GatewayIntentBits.GuildMembers, // Buat akses info member server, kayak username yang ngirim pesan. WAJIB aktifin juga di Developer Portal.
    // GatewayIntentBits.GuildPresences, // Opsional nih. Kalo emang butuh info status online/offline user. Tapi kudu aktifin juga.
  ],
});

// === INISIALISASI GEMINI AI ===
// Ini cara bot lu "ngobrol" sama Gemini AI.
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY); // Inisialisasi API Gemini.
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Pake model `gemini-2.5-flash` biar cepet responsnya. Bisa diganti ke yang lain kalo mau, tapi ini paling oke buat chat "kayaknya".

// === MAP BUAT STATUS PAUSE AI PER CHANNEL ===
// Ini buat nyimpen data channel mana aja yang AI-nya di-pause. Jadi tiap channel tiket bisa diatur AI-nya idup/mati.
const AI_PAUSE_STATUS = new Map(); // Bentuknya `{ channelId: true/false }`, true artinya dipause.
const PAUSE_STATUS_FILE = path.join(__dirname, "ai_pause_status.json"); // File buat nyimpen status pause ini biar gak ilang pas bot restart.

// === FUNCTION SIMPEN DAN LOAD STATUS PAUSE ===
// Fungsi buat ngelola status AI pause di setiap channel.
async function savePauseStatus() {
  const obj = {};
  AI_PAPAUSE_STATUS.forEach((value, key) => {
    obj[key] = value;
  });
  // Nulis objek status pause ke file JSON. Biar persist.
  await fs.writeFile(PAUSE_STATUS_FILE, JSON.stringify(obj, null, 2));
}

async function loadPauseStatus() {
  try {
    const rawData = await fs.readFile(PAUSE_STATUS_FILE, "utf8");
    const parsedData = JSON.parse(rawData);
    for (const key in parsedData) {
      AI_PAUSE_STATUS.set(key, parsedData[key]);
    }
    console.log("Status AI pause berhasil dimuat."); // Kalo berhasil, muncul di konsol.
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("File status AI pause tidak ditemukan, mulai dari awal."); // Kalo file-nya belum ada, yaudah bikin baru.
    } else {
      console.error("Gagal memuat status AI pause:", error); // Kalo ada error lain, laporin.
    }
  }
}

// === UTILITIES BUAT BACA TEMPLATE DAN DATA ===
// Fungsi-fungsi pembantu buat ngambil data dari file.
async function getTemplatePrompt() {
  try {
    return await fs.readFile(TEMPLATE_PATH, "utf8"); // Baca file `luckie-template.txt`.
  } catch {
    console.error("Gagal membaca template prompt. Menggunakan default.");
    return "Kamu adalah Luckie, AI dari ExtremesID."; // Kalo gagal, pake template default.
  }
}

async function getStockData() {
  try {
    const raw = await fs.readFile(
      path.join(__dirname, "dataStock.json"),
      "utf8",
    );
    return JSON.parse(raw); // Baca file `dataStock.json` terus diparse jadi objek JavaScript.
  } catch (err) {
    console.error("Gagal membaca data stok:", err); // Kalo error, kasih tahu.
    return null; // Balikin null biar fungsi yang manggil bisa tahu kalo datanya gak ada.
  }
}

function formatRupiah(number) {
  // Fungsi buat format angka jadi rupiah biar rapi. #BanggaRupiah
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

// === CEK STOK TERSEDIA BERDASARKAN CATEGORY & PLAN ===
// Fungsi ini penting buat ngecek ketersediaan stok hosting.
function checkStockAvailability(categoryName, planName, stockData) {
  const category = stockData.categories[categoryName.toUpperCase()]; // Ambil kategori (misal: MINECRAFT).
  if (!category)
    return { isAvailable: false, summaryRam: 0, summaryStorage: 0 }; // Kalo kategori gak ada, ya gak available.

  const summaryEntry = category.summary.find(
    (s) => s.tingkat.toUpperCase() === planName.toUpperCase(),
  ); // Cari ringkasan stok per plan.

  if (summaryEntry) {
    const summaryRam = parseFloat(summaryEntry.ram.replace("GB", "")); // Ambil RAM dari summary.
    const summaryStorage = parseFloat(summaryEntry.storage.replace("GB", "")); // Ambil storage dari summary.

    // Prioritaskan `is_available` kalo ada dan `false`.
    if (summaryEntry.is_available === false) {
      return {
        isAvailable: false,
        summaryRam: summaryRam,
        summaryStorage: summaryStorage,
      };
    }
    // Kalo `is_available` gak ada atau `true`, cek RAM-nya kurang dari 2GB gak.
    // Ini aturan lo: kalo RAM-nya di bawah 2GB, dianggap gak tersedia.
    if (summaryRam < 2) {
      return {
        isAvailable: false,
        summaryRam: summaryRam,
        summaryStorage: summaryStorage,
      };
    }
    return {
      isAvailable: true,
      summaryRam: summaryRam,
      summaryStorage: summaryStorage,
    };
  }
  return { isAvailable: false, summaryRam: 0, summaryStorage: 0 }; // Kalo plan-nya gak ketemu di summary.
}

// === ANALISIS NIAT PENGGUNA DARI PESANNYA ===
// Fungsi ini kayak stalker jir, buat nebak maunya user apa dari chat-nya.
function analyzeIntent(content, stockData) {
  const lower = content.toLowerCase(); // Ubah pesan jadi huruf kecil semua biar gampang ngeceknya.
  const result = {
    category: null, // Kategori hosting (misal: Minecraft, VPS).
    plan: null, // Nama plan (misal: ENHANCE, STANDARD).
    gb: null, // Jumlah GB RAM yang ditanya.
    isSpecificQuery: false, // Kalo pertanyaannya spesifik banget.
    queryType: "general", // Tipe pertanyaan: "list_packages", "buy", "contact", "price_spec", atau "general".
  };

  // Cek intent umum dulu.
  if (/paket apa saja|list paket|daftar hosting/.test(lower)) {
    result.queryType = "list_packages"; // Kalo user nanya daftar paket.
    return result;
  } else if (/beli|order|mau beli/.test(lower)) {
    result.queryType = "buy"; // Kalo user mau beli.
    return result;
  } else if (/kontak|hubungi|admin|whatsapp|wa/.test(lower)) {
    result.queryType = "contact"; // Kalo user mau kontak admin.
    return result;
  }

  let foundCategory = null;
  let foundPlan = null;

  // Cek kategori dan plan dari data stok.
  const categories = Object.keys(stockData.categories);
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) {
      foundCategory = cat; // Kategori ketemu!
      const plansInCat = Object.keys(stockData.categories[cat].detail);
      for (const plan of plansInCat) {
        if (lower.includes(plan.toLowerCase())) {
          foundPlan = plan; // Plan ketemu!
          break;
        }
      }
      if (foundPlan) break;
    }
  }

  if (foundCategory) result.category = foundCategory;
  if (foundPlan) result.plan = foundPlan;

  // Cek ada angka GB gak di pesan.
  const gbMatch = lower.match(/(\d+(\.\d+)?)\s*gb/);
  if (gbMatch) result.gb = parseFloat(gbMatch[1]);

  // Kalo kategori, plan, dan GB ketemu, berarti spesifik.
  if (result.category && result.plan && result.gb) {
    result.isSpecificQuery = true;
    result.queryType = "price_spec"; // Pertanyaan harga/spesifikasi spesifik.
  } else if (
    result.category &&
    result.plan &&
    /harga|berapa|biaya|tarif|spesifikasi|info/.test(lower)
  ) {
    result.isSpecificQuery = true;
    result.queryType = "price_spec"; // Pertanyaan harga/spesifikasi umum (tanpa GB).
  }

  return result;
}

// === BALASAN FORMAT KHUSUS BUAT NIAT SPESIFIK (ORDER, LIST, HARGA, DLL) ===
// Fungsi ini yang nyiapin jawaban buat pertanyaan spesifik.
async function generateFormattedReply(content, username, data) {
  const intent = analyzeIntent(content, data); // Tebak lagi niat user.
  const { category, plan, gb, queryType } = intent;

  if (queryType === "list_packages") {
    let reply = `Halo kak **${username}**! ExtremesID menyediakan berbagai jenis hosting. Berikut daftar paket yang tersedia:\n\n`;
    Object.entries(data.categories).forEach(([catKey, catValue]) => {
      reply += `✨ **Hosting ${catKey.toUpperCase()}**:\n`;
      Object.entries(catValue.detail).forEach(([planKey, planValue]) => {
        const { isAvailable } = checkStockAvailability(catKey, planKey, data); // Cek stoknya.
        const status = isAvailable ? "✅ Ready" : "❌ Stok Habis";
        reply += `- \`${planKey}\` (${planValue.description}) - ${status}\n`;
      });
      reply += "\n";
    });
    reply += `Untuk info lebih detail seperti harga dan spesifikasi, kakak bisa sebutkan **jenis hosting**, **paket**, dan **jumlah RAM**-nya ya. Contoh: \`harga Minecraft ENHANCE 2GB\` atau \`info VPS STANDARD\`.`;
    return reply;
  }

  if (queryType === "buy") {
    return `Halo kak **${username}**! Untuk pembelian, kakak bisa langsung menghubungi salah satu admin kami di channel ini atau private message ya. Mereka akan bantu proses order kakak.`;
  }

  if (queryType === "contact") {
    // Kalo user nanya kontak, kasih link WA (kalo ada di data) sama website.
    const firstCategoryKey = Object.keys(data.categories)[0];
    const firstPlanKey = Object.keys(
      data.categories[firstCategoryKey].detail,
    )[0];
    const whatsappLink = data.categories[firstCategoryKey].detail[
      firstPlanKey
    ]?.location?.includes("WEST JAVA")
      ? `https://wa.me/+6288987416154` // Ini contoh, bisa diganti ke nomor WA admin lu lu pada.
      : `kontak admin kami`;
    const websiteLink = data.website || "https://extremes.web.id"; // Pastiin ada di `dataStock.json` field `website`.

    return `Halo kak **${username}**! Kakak bisa menghubungi admin kami melalui beberapa cara:
📞 **Di Discord ini**: Cukup tag admin atau bertanya di channel yang sesuai.
💬 **WhatsApp**: Jika butuh respon cepat untuk masalah tertentu atau AI tidak bisa membantu, bisa chat ke ${whatsappLink}.
🔗 **Website**: Kunjungi ${websiteLink} untuk informasi lebih lanjut.`;
  }

  // Kalo niatnya `price_spec` tapi kategori/plan gak ketemu, atau emang pertanyaan general.
  if (!category || !plan) {
    let generalReply = `Halo kak **${username}**! 👋 Untuk info harga atau spesifikasi, kakak bisa sebutkan **jenis hosting** (misalnya Minecraft, VPS, Website) dan **paket** serta **jumlah RAM** yang dibutuhkan. Contoh: \`harga Minecraft ENHANCE 2GB\` atau \`info VPS STANDARD\`.

Kalau kakak ingin tahu paket apa saja yang tersedia, ketik saja \`list paket\`.`;
    return generalReply;
  }

  // --- MULAI DARI SINI: 'category' dan 'plan' DIJAMIN ADA dan TERDETEKSI DARI dataStock.json ---
  // Ini artinya AI udah berhasil nebak kategori dan plan yang user maksud.
  const selectedCategory = data.categories[category.toUpperCase()];
  const selectedPlan = selectedCategory.detail[plan.toUpperCase()];

  // Pengecekan ekstra (harusnya sih gak perlu kalo `analyzeIntent` bener)
  if (!selectedCategory || !selectedPlan) {
    console.error(
      `Error: Kategori atau Plan tidak ditemukan setelah analisis niat untuk kategori: ${category}, plan: ${plan}`,
    );
    return `Maaf kak **${username}**, informasi untuk **${category} ${plan}** tidak ditemukan. Mungkin ada kesalahan pada data stok atau pertanyaan kakak kurang spesifik.`;
  }

  const { isAvailable, summaryRam } = checkStockAvailability(
    category,
    plan,
    data,
  );
  let reply = `💡 **Info Paket ${selectedCategory.type.toUpperCase()} ${plan.toUpperCase()}**\n`;
  let stockStatusMessage = "";

  if (!isAvailable) {
    stockStatusMessage = `\n❌ Maaf kak, stok untuk paket **${plan.toUpperCase()}** (${selectedCategory.type.toUpperCase()}) sedang kosong atau RAM yang tersedia kurang dari 2GB. Silakan cek paket lain atau hubungi admin.`;
  } else if (gb && summaryRam && gb > summaryRam) {
    // Kalo user nanya RAM lebih dari yang ada di summary.
    stockStatusMessage = `\n⚠️ Perhatian: Kamu menanyakan ${gb}GB, tapi stok RAM maksimum yang tersedia untuk paket **${plan.toUpperCase()}** saat ini adalah **${summaryRam}GB**.`;
    // Sarankan paket yang paling mendekati.
    const bestPlanDetail = Object.values(selectedPlan.plans).find(
      (p) =>
        parseFloat(p.ram.replace("GB DDR4", "GB").replace("GB", "")) ===
        summaryRam,
    );
    if (bestPlanDetail) {
      stockStatusMessage += ` Kami sarankan paket **${summaryRam}GB** dengan harga **${formatRupiah(bestPlanDetail.price)}**.`;
    } else {
      stockStatusMessage += ` Silakan pilih RAM yang tersedia hingga ${summaryRam}GB.`;
    }
  }

  if (gb) {
    // Kalo user nanya RAM spesifik.
    const planDetails = Object.values(selectedPlan.plans).find(
      (p) =>
        parseFloat(p.ram.replace("GB DDR4", "GB").replace("GB", "")) === gb,
    );
    if (planDetails) {
      // Kalo paket dengan RAM segitu ada.
      reply += `💰 Harga untuk ${gb}GB: **${formatRupiah(planDetails.price)}**\n`;
      reply += `📦 Storage: ${planDetails.storage}\n`;
      reply += `🚀 CPU: ${planDetails.cpu}, Bandwidth: ${planDetails.bandwidth}\n`;
      reply += `📍 Lokasi: ${planDetails.location}`;
    } else {
      // Kalo paket dengan RAM segitu gak ada, coba hitung perkiraan dari paket 1GB (kalo ada).
      const basePlan = Object.values(selectedPlan.plans).find(
        (p) =>
          parseFloat(p.ram.replace("GB DDR4", "GB").replace("GB", "")) === 1,
      );
      if (basePlan) {
        const baseGBValue = parseFloat(
          basePlan.ram.replace("GB DDR4", "GB").replace("GB", ""),
        );
        const pricePerGB = basePlan.price / baseGBValue;
        const estimatedPrice = pricePerGB * gb;

        reply += `💰 Estimasi Harga untuk ${gb}GB: **${formatRupiah(estimatedPrice)}** _(berdasarkan harga ${baseGBValue}GB: ${formatRupiah(basePlan.price)})_\n`;
        reply += `📦 Storage: (Estimasi sekitar ${parseFloat(basePlan.storage) * (gb / baseGBValue)}GB) \n`;
        reply += `🚀 CPU: ${basePlan.cpu}, Bandwidth: ${basePlan.bandwidth}\n`;
        reply += `📍 Lokasi: ${basePlan.location}`;
      } else {
        reply += `Maaf kak, rincian harga untuk ${gb}GB pada paket **${plan.toUpperCase()}** belum tersedia.`;
      }
    }
  } else {
    // Kalo user cuma nyebut nama paket, tampilkan semua detail plan di paket itu.
    reply += `Berikut adalah daftar harga dan spesifikasi untuk paket **${plan.toUpperCase()}**:\n`;
    Object.entries(selectedPlan.plans).forEach(([key, planDetail]) => {
      const ramValue = parseFloat(
        planDetail.ram.replace("GB DDR4", "GB").replace("GB", ""),
      );
      reply += `- **${ramValue}GB**: Harga: **${formatRupiah(planDetail.price)}**\n`;
      reply += `  Storage: ${planDetail.storage}, CPU: ${planDetail.cpu}, Bandwidth: ${planDetail.bandwidth}, Lokasi: ${planDetail.location}\n`;
    });
  }

  reply += stockStatusMessage; // Tambahin info status stok di akhir.

  // Ini buat memastikan kalimat penutup cuma muncul sekali dan rapi.
  const closingSentence = `\n\n💬 Kalau ada yang ingin ditanyakan lagi, langsung aja ya kak!`;
  if (!reply.includes(closingSentence.trim())) {
    reply = reply
      .replace(/kalau ada yang mau ditanyakan lagi, jangan ragu ya!/gi, "")
      .trim();
    reply = reply.replace(/ada lagi yang bisa luckie bantu?/gi, "").trim();
    reply = reply.replace(/jangan ragu untuk bertanya lagi./gi, "").trim();
    reply += closingSentence;
  }
  return reply;
}

// === BOT READY EVENT (SAAT ONLINE) ===
// Ini jalan pas bot pertama kali online.
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`); // Ngasih tau di konsol kalo bot udah online.
  await loadPauseStatus(); // Muat status pause AI dari file. Penting biar setelan AI gak ke-reset pas bot restart.
});

// === EVENT UTAMA: HANDLE MESSAGE MASUK ===
// Ini jantungnya bot. Setiap ada pesan masuk, fungsi ini jalan.
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Abaikan pesan dari bot lain (biar gak infinite loop).

  const username = message.author.username; // Ambil username yang ngirim pesan.
  const content = message.content.trim(); // Ambil isi pesan, hapus spasi di awal/akhir.
  const args = content.slice(COMMAND_PREFIX.length).trim().split(/ +/); // Pisahin argumen command.
  const command = args.shift().toLowerCase(); // Ambil command-nya.

  // --- START: Command Handling ---
  // Ini bagian buat ngurusin command admin.
  if (content.startsWith(COMMAND_PREFIX)) {
    // Pastiin cuma admin yang bisa pake command ini.
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "❌ Maaf, hanya administrator yang bisa menggunakan perintah ini.",
      );
    }

    if (command === "control") {
      if (args.length === 0) {
        // Kalo cuma `!sk control`, tampilkan status AI di semua channel tiket.
        const ticketCategory =
          message.guild.channels.cache.get(TICKET_CATEGORY_ID);
        if (
          !ticketCategory ||
          ticketCategory.type !== ChannelType.GuildCategory
        ) {
          return message.reply(
            "❌ ID kategori tiket tidak valid atau tidak ditemukan.",
          );
        }

        const channelsInTicketCategory = ticketCategory.children.cache
          .filter((c) => c.type === ChannelType.GuildText) // Filter cuma channel teks.
          .sort((a, b) => a.position - b.position); // Urutkan channel berdasarkan posisinya.

        let replyContent = `**📋 Status AI di Kategori Tiket (${ticketCategory.name})**\n\n`;
        if (channelsInTicketCategory.size === 0) {
          replyContent += "Tidak ada channel tiket aktif.";
        } else {
          channelsInTicketCategory.forEach((channel) => {
            const status = AI_PAUSE_STATUS.get(channel.id)
              ? "DINONAKTIFKAN (Paused) ⏸️" // Kalo dipause.
              : "AKTIF (Playing) ▶️"; // Kalo aktif.
            replyContent += `- <#${channel.id}> (${channel.name}): **${status}**\n`;
          });
        }
        replyContent += `\n!sk control <parameter> <#channel>\n\n \nUntuk mengontrol AI: \`\`\`${COMMAND_PREFIX} control ai-stop <#channel>\`\`\` atau \`\`\`${COMMAND_PREFIX} control ai-play <#channel>\`\`\``;
        return message.reply(replyContent);
      } else if (args[0] === "ai-stop" || args[0] === "ai-play") {
        // Kalo ada `ai-stop` atau `ai-play`.
        const channelMention = args[1];
        const targetChannelId = channelMention
          ? channelMention.replace(/[<#>]/g, "")
          : null; // Ambil ID channel dari mention.

        if (!targetChannelId) {
          return message.reply(
            `❌ Format perintah salah. Gunakan: \`${COMMAND_PREFIX} control ${args[0]} <#channel>\``,
          );
        }

        const targetChannel = message.guild.channels.cache.get(targetChannelId);

        // Pastiin channelnya bener-bener channel tiket di kategori yang udah diset.
        if (
          !targetChannel ||
          targetChannel.parentId !== TICKET_CATEGORY_ID ||
          targetChannel.type !== ChannelType.GuildText
        ) {
          return message.reply(
            `❌ Channel <#${targetChannelId}> tidak ditemukan atau bukan channel tiket di kategori yang ditentukan.`,
          );
        }

        const action = args[0] === "ai-stop" ? true : false; // `true` kalo mau dipause, `false` kalo mau di-play.
        AI_PAUSE_STATUS.set(targetChannel.id, action); // Set status AI di channel itu.
        await savePauseStatus(); // Simpen status ke file biar gak ilang.

        const statusText = action ? "DINONAKTIFKAN" : "DIAKTIFKAN KEMBALI";
        return message.reply(
          `✅ AI Luckie berhasil **${statusText}** di channel <#${targetChannel.id}>.`,
        );
      }
    }
    // Kalo command-nya gak dikenal.
    if (content.startsWith(COMMAND_PREFIX)) {
      return message.reply(
        `❌ Perintah \`${command}\` tidak dikenal. Gunakan \`${COMMAND_PREFIX} control\` untuk melihat opsi.`,
      );
    }
  }
  // --- END: Command Handling ---

  // Kalo pesan bukan dari command admin dan gak di channel tiket, ya udah skip aja.
  if (message.channel.parentId !== TICKET_CATEGORY_ID) return;

  // Cek apakah AI lagi dipause di channel ini. Kalo iya, gak usah respons.
  if (AI_PAUSE_STATUS.get(message.channel.id) === true) {
    return; // AI dipause, jangan merespons
  }

  try {
    // Ambil data stok sama template prompt secara barengan (biar cepet).
    const [data, promptTemplate] = await Promise.all([
      getStockData(),
      getTemplatePrompt(),
    ]);

    if (!data || !data.categories) {
      // Pengecekan data `dataStock.json` kosong atau rusak.
      console.error("dataStock.json kosong atau rusak:", data);
      return await message.reply(
        "Maaf kak, data stok layanan tidak tersedia atau formatnya salah. Silakan hubungi admin.",
      );
    }

    const intent = analyzeIntent(content, data); // Tebak niat user.

    // Kalo ada niat spesifik (kayak nanya harga, list paket, beli, kontak), langsung jawab pake fungsi `generateFormattedReply`.
    // Ini biar bot langsung to the point tanpa muter-muter pake AI generik.
    if (intent.queryType !== "general" || (intent.category && intent.plan)) {
      const reply = await generateFormattedReply(content, username, data);
      return await message.reply(reply);
    }

    // Kalo gak ada niat spesifik (pertanyaan umum), baru deh oper ke Gemini AI.
    const messages = await message.channel.messages.fetch({ limit: 10 }); // Ambil 10 pesan terakhir di channel itu.
    const conversation = Array.from(messages.values())
      .reverse() // Balik urutan pesan biar kronologis.
      .map((m) => `${m.author.username}: ${m.content}`) // Format jadi `Username: Isi Pesan`.
      .join("\n"); // Gabungin jadi satu string.

    // Siapin data stok yang lebih detail buat dikasih ke Gemini.
    // Ini biar Gemini tahu info-info hosting kita.
    const stockDataForGemini = Object.entries(data.categories)
      .map(([catKey, catValue]) => {
        let categoryInfo = `- **${catKey.toUpperCase()}**:\n`;
        const plansInfo = Object.entries(catValue.detail)
          .map(([planKey, planDetail]) => {
            const { isAvailable, summaryRam } = checkStockAvailability(
              catKey,
              planKey,
              data,
            );
            let status = isAvailable ? "Tersedia" : "Stok Habis";
            if (isAvailable && summaryRam > 0) {
              status += ` (Maks RAM: ${summaryRam}GB)`;
            }
            const planPrices = Object.values(planDetail.plans)
              .map(
                (p) =>
                  `${parseFloat(p.ram.replace("GB DDR4", "GB").replace("GB", ""))}GB: ${formatRupiah(p.price)}`,
              )
              .join(", ");
            return `  - ${planKey}: ${planDetail.description}. Status: ${status}. Harga mulai dari: (${planPrices})`;
          })
          .join("\n");
        return categoryInfo + plansInfo;
      })
      .join("\n\n");

    // Ini prompt utama yang dikirim ke Gemini.
    // Ada template-nya, data stok, sama riwayat percakapan.
    const prompt = `${promptTemplate}\n\nData Harga & Stok Layanan ExtremesID:\n${stockDataForGemini}\n\nPercakapan:\n${conversation}\nLuckie:`;

    const result = await model.generateContent(prompt); // Kirim prompt ke Gemini!
    let reply = result.response.text().trim(); // Ambil jawaban dari Gemini.

    // Ini buat mastiin "Halo kak" cuma muncul sekali.
    if (!/^halo kak/i.test(reply)) {
      reply = `Halo kak **${username}**! ` + reply;
    }

    // Ini juga buat mastiin kalimat penutup cuma muncul sekali dan rapi.
    const closingSentence = `\n\n💬 Kalau ada yang ingin ditanyakan lagi, langsung aja ya kak!`;
    if (!reply.includes(closingSentence.trim())) {
      reply = reply
        .replace(/kalau ada yang mau ditanyakan lagi, jangan ragu ya!/gi, "")
        .trim();
      reply = reply.replace(/ada lagi yang bisa luckie bantu\?/gi, "").trim();
      reply = reply.replace(/jangan ragu untuk bertanya lagi\./gi, "").trim();
      reply = reply.replace(/perlu info lain, kak\?/gi, "").trim();
      reply = reply
        .replace(/mau sekalian dicekin harganya juga\?/gi, "")
        .trim();
      reply += closingSentence;
    }

    await message.reply(reply); // Balas pesan user.
  } catch (err) {
    console.error("Error:", err); // Kalo ada error, munculin di konsol.
    await message.reply(
      "Maaf kak, ada gangguan teknis. Kontak admin ya: https://wa.me/+6288987416154",
    ); // Kasih tahu user kalo ada error.
  }
});

// === LOGIN ===
client.login(DISCORD_TOKEN); // Ini yang bikin bot lu nyambung ke Discord. JANGAN SAMPE GAGAL!

// === SELESAI! ===
// Yang mau oprek bagian bawah: pastikan lu kaga TOLOL dan ngerti logic intent dan AI.
// Kalau gak yakin, tanya dulu. Jangan asal ubah bagian AI & data parser-nya.
// Semoga bermanfaat. maaf masih pemula ✌️
