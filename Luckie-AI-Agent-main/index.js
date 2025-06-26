// index.js
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");
const { EmbedBuilder } = require('discord.js');

// Konfigurasi
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// ID KATEGORI TEMPAT TIKET DIBUAT (misal: "123456789012345678")
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
// PREFIX UNTUK PERINTAH KONTROL (misal: "!sk")
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || "!sk";

const TEMPLATE_PATH = path.join(__dirname, "luckie-template.txt");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Privileged Intent, harus diaktifkan di Developer Portal
    GatewayIntentBits.GuildMembers, // Privileged Intent, harus diaktifkan di Developer Portal
    // GatewayIntentBits.GuildPresences, // Opsional, hanya jika benar-benar dibutuhkan, dan harus diaktifkan
  ],
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Map untuk menyimpan status AI per channel tiket: { 'channelId': true/false (paused/not paused) }
const AI_PAUSE_STATUS = new Map();
const PAUSE_STATUS_FILE = path.join(__dirname, "ai_pause_status.json");

// --- Fungsi untuk Mengelola Status Pause ---
async function savePauseStatus() {
  const obj = {};
  AI_PAUSE_STATUS.forEach((value, key) => {
    obj[key] = value;
  });
  await fs.writeFile(PAUSE_STATUS_FILE, JSON.stringify(obj, null, 2));
}

async function loadPauseStatus() {
  try {
    const rawData = await fs.readFile(PAUSE_STATUS_FILE, "utf8");
    const parsedData = JSON.parse(rawData);
    for (const key in parsedData) {
      AI_PAUSE_STATUS.set(key, parsedData[key]);
    }
    console.log("AI pause status loaded.");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No AI pause status file found, starting fresh.");
    } else {
      console.error("Failed to load AI pause status:", error);
    }
  }
}

// --- Fungsi Bot Utilities ---
async function getTemplatePrompt() {
  try {
    return await fs.readFile(TEMPLATE_PATH, "utf8");
  } catch {
    console.error("Failed to read template prompt. Using default.");
    return "Kamu adalah Luckie, AI dari ExtremesID.";
  }
}

async function getStockData() {
  try {
    const raw = await fs.readFile(
      path.join(__dirname, "dataStock.json"),
      "utf8",
    );
    return JSON.parse(raw);
  } catch (err) {
    console.error("Gagal membaca data stok:", err);
    return null;
  }
}

function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

// Fungsi untuk memeriksa stok berdasarkan summary
// Mengembalikan objek { isAvailable: boolean, summaryRam: number, summaryStorage: number }
function checkStockAvailability(categoryName, planName, stockData) {
  const category = stockData.categories[categoryName.toUpperCase()];
  if (!category)
    return { isAvailable: false, summaryRam: 0, summaryStorage: 0 };

  const summaryEntry = category.summary.find(
    (s) => s.tingkat.toUpperCase() === planName.toUpperCase(),
  );

  if (summaryEntry) {
    const summaryRam = parseFloat(summaryEntry.ram.replace("GB", ""));
    const summaryStorage = parseFloat(summaryEntry.storage.replace("GB", ""));

    // Prioritaskan is_available jika ada dan false
    if (summaryEntry.is_available === false) {
      return {
        isAvailable: false,
        summaryRam: summaryRam,
        summaryStorage: summaryStorage,
      };
    }
    // Jika tidak ada is_available atau true, cek RAM < 2GB
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
  return { isAvailable: false, summaryRam: 0, summaryStorage: 0 };
}

function analyzeIntent(content, stockData) {
  const lower = content.toLowerCase();
  const result = {
    category: null,
    plan: null,
    gb: null,
    isSpecificQuery: false,
    queryType: "general",
  };

  if (/paket apa saja|list paket|daftar hosting/.test(lower)) {
    result.queryType = "list_packages";
    return result;
  } else if (/beli|order|mau beli/.test(lower)) {
    result.queryType = "buy";
    return result;
  } else if (/kontak|hubungi|admin|whatsapp|wa/.test(lower)) {
    result.queryType = "contact";
    return result;
  }

  let foundCategory = null;
  let foundPlan = null;

  const categories = Object.keys(stockData.categories);
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) {
      foundCategory = cat;
      const plansInCat = Object.keys(stockData.categories[cat].detail);
      for (const plan of plansInCat) {
        if (lower.includes(plan.toLowerCase())) {
          foundPlan = plan;
          break;
        }
      }
      if (foundPlan) break;
    }
  }

  if (foundCategory) result.category = foundCategory;
  if (foundPlan) result.plan = foundPlan;

  const gbMatch = lower.match(/(\d+(\.\d+)?)\s*gb/);
  if (gbMatch) result.gb = parseFloat(gbMatch[1]);

  if (result.category && result.plan && result.gb) {
    result.isSpecificQuery = true;
    result.queryType = "price_spec";
  } else if (
    result.category &&
    result.plan &&
    /harga|berapa|biaya|tarif|spesifikasi|info/.test(lower)
  ) {
    result.isSpecificQuery = true;
    result.queryType = "price_spec";
  }

  return result;
}

async function generateFormattedReply(content, username, data) {
  const intent = analyzeIntent(content, data);
  const { category, plan, gb, queryType } = intent;

  if (queryType === "list_packages") {
    let reply = `Halo kak **${username}**! ExtremesID menyediakan berbagai jenis hosting. Berikut daftar paket yang tersedia:\n\n`;
    Object.entries(data.categories).forEach(([catKey, catValue]) => {
      reply += `✨ **Hosting ${catKey.toUpperCase()}**:\n`;
      Object.entries(catValue.detail).forEach(([planKey, planValue]) => {
        const { isAvailable } = checkStockAvailability(catKey, planKey, data);
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
    // Dapatkan lokasi dari salah satu detail pertama untuk contoh WhatsApp
    const firstCategoryKey = Object.keys(data.categories)[0];
    const firstPlanKey = Object.keys(
      data.categories[firstCategoryKey].detail,
    )[0];
    const whatsappLink = data.categories[firstCategoryKey].detail[
      firstPlanKey
    ]?.location?.includes("WEST JAVA")
      ? `https://wa.me/+6288987416154`
      : `kontak admin kami`;
    const websiteLink = data.website || "https://extremes.web.id";

    return `Halo kak **${username}**! Kakak bisa menghubungi admin kami melalui beberapa cara:
📞 **Di Discord ini**: Cukup tag admin atau bertanya di channel yang sesuai.
💬 **WhatsApp**: Jika butuh respon cepat untuk masalah tertentu atau AI tidak bisa membantu, bisa chat ke ${whatsappLink}.
🔗 **Website**: Kunjungi ${websiteLink} untuk informasi lebih lanjut.`;
  }

  // If the query type is "price_spec" but category/plan still null, or it's genuinely general query.
  // This handles cases where analyzeIntent couldn't find a category/plan for a price/spec query.
  if (!category || !plan) {
    let generalReply = `Halo kak **${username}**! 👋 Untuk info harga atau spesifikasi, kakak bisa sebutkan **jenis hosting** (misalnya Minecraft, VPS, Website) dan **paket** serta **jumlah RAM** yang dibutuhkan. Contoh: \`harga Minecraft ENHANCE 2GB\` atau \`info VPS STANDARD\`.

Kalau kakak ingin tahu paket apa saja yang tersedia, ketik saja \`list paket\`.`;
    return generalReply;
  }

  // --- MULAI DARI SINI: 'category' dan 'plan' DIJAMIN ADA dan TERDETEKSI DARI dataStock.json ---
  // Pastikan data yang diambil dari dataStock itu ada sebelum diakses .toUpperCase()
  const selectedCategory = data.categories[category.toUpperCase()];
  const selectedPlan = selectedCategory.detail[plan.toUpperCase()];

  // Pengecekan ekstra jika entah bagaimana selectedCategory/selectedPlan masih undefined (seharusnya tidak jika logic analyzeIntent benar)
  if (!selectedCategory || !selectedPlan) {
    console.error(
      `Error: Category or Plan not found after intent analysis for category: ${category}, plan: ${plan}`,
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
    // Jika customer meminta RAM lebih dari yang tersedia di summary
    stockStatusMessage = `\n⚠️ Perhatian: Kamu menanyakan ${gb}GB, tapi stok RAM maksimum yang tersedia untuk paket **${plan.toUpperCase()}** saat ini adalah **${summaryRam}GB**.`;
    // Sarankan yang terbaik
    const bestPlanDetail = Object.values(selectedPlan.plans).find(
      (p) =>
        parseFloat(p.ram.replace("GB DDR4", "GB").replace("GB", "")) ===
        summaryRam,
    );
    if (bestPlanDetail) {
      stockStatusMessage += ` Kami sarankan paket **${summaryRam}GB** dengan harga **${formatRupiah(bestPlanDetail.price)}**.`;
    } else {
      // Fallback jika detail untuk summaryRam tidak ditemukan di plans (jarang terjadi tapi mungkin)
      stockStatusMessage += ` Silakan pilih RAM yang tersedia hingga ${summaryRam}GB.`;
    }
  }

  if (gb) {
    // Jika ada permintaan RAM spesifik
    const planDetails = Object.values(selectedPlan.plans).find(
      (p) =>
        parseFloat(p.ram.replace("GB DDR4", "GB").replace("GB", "")) === gb,
    );
    if (planDetails) {
      reply += `💰 Harga untuk ${gb}GB: **${formatRupiah(planDetails.price)}**\n`;
      reply += `📦 Storage: ${planDetails.storage}\n`;
      reply += `🚀 CPU: ${planDetails.cpu}, Bandwidth: ${planDetails.bandwidth}\n`;
      reply += `📍 Lokasi: ${planDetails.location}`;
    } else {
      // Cek jika harga per GB bisa dihitung dari plan 1GB (jika ada)
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
        reply += `📦 Storage: (Estimasi sekitar ${parseFloat(basePlan.storage) * (gb / baseGBValue)}GB) \n`; // Estimasi storage
        reply += `🚀 CPU: ${basePlan.cpu}, Bandwidth: ${basePlan.bandwidth}\n`;
        reply += `📍 Lokasi: ${basePlan.location}`;
      } else {
        reply += `Maaf kak, rincian harga untuk ${gb}GB pada paket **${plan.toUpperCase()}** belum tersedia.`;
      }
    }
  } else {
    // Jika hanya nama paket, tampilkan semua rencana yang tersedia
    reply += `Berikut adalah daftar harga dan spesifikasi untuk paket **${plan.toUpperCase()}**:\n`;
    Object.entries(selectedPlan.plans).forEach(([key, planDetail]) => {
      const ramValue = parseFloat(
        planDetail.ram.replace("GB DDR4", "GB").replace("GB", ""),
      );
      reply += `- **${ramValue}GB**: Harga: **${formatRupiah(planDetail.price)}**\n`;
      reply += `  Storage: ${planDetail.storage}, CPU: ${planDetail.cpu}, Bandwidth: ${planDetail.bandwidth}, Lokasi: ${planDetail.location}\n`;
    });
  }

  reply += stockStatusMessage; // Tambahkan status stok setelah info harga/spesifikasi

  // Final closing sentence for all replies, ensure no duplication
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

// --- Event Listener: Bot Ready ---
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await loadPauseStatus(); // Muat status pause saat bot online
});

// --- HAPUS EVENT channelCreate DAN interactionCreate UNTUK KONTROL TOMBOL ---
// Ini dihapus karena kita akan menggunakan perintah Discord untuk kontrol AI.
// client.on("channelCreate", ...);
// client.on("interactionCreate", ...);

// --- Event Listener: Message Create ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Abaikan pesan dari bot

  const username = message.author.username;
  const content = message.content.trim();
  const args = content.slice(COMMAND_PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- START: Command Handling ---
  if (content.startsWith(COMMAND_PREFIX)) {
    // Administrator permission check
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      const unauthorizedEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("⛔ Akses Ditolak")
        .setDescription(
          "Anda tidak memiliki izin untuk menggunakan perintah ini.",
        )
        .addFields(
          { name: "Diperlukan", value: "Administrator", inline: true },
          { name: "Pengguna", value: message.author.tag, inline: true },
        )
        .setTimestamp()
        .setFooter({
          text: "Sistem Keamanan • ExtremesID",
          iconURL: message.guild.iconURL(),
        });

      console.log(
        `🚨 [UNAUTHORIZED ACCESS] ${message.author.tag} (${message.author.id}) mencoba menjalankan command "${command}" di #${message.channel.name}`,
      );
      return message.reply({ embeds: [unauthorizedEmbed] });
    }

    if (command === "control") {
      // Enhanced command logging
      console.log(`\n📊 [COMMAND EXECUTED] ${new Date().toLocaleString()}
  ├─ Pengguna: ${message.author.tag} (${message.author.id})
  ├─ Server: ${message.guild.name} (${message.guild.id})
  └─ Channel: #${message.channel.name} (${message.channel.id})\n`);

      if (args.length === 0) {
        // !sk control: Show channel list and AI status
        const ticketCategory =
          message.guild.channels.cache.get(TICKET_CATEGORY_ID);

        if (
          !ticketCategory ||
          ticketCategory.type !== ChannelType.GuildCategory
        ) {
          const errorEmbed = new EmbedBuilder()
            .setColor("#FF3333")
            .setTitle("🔧 Error Konfigurasi")
            .setDescription(
              "Kategori tiket tidak ditemukan atau ID tidak valid.",
            )
            .addFields(
              { name: "ID Kategori", value: TICKET_CATEGORY_ID, inline: true },
              {
                name: "Status",
                value: ticketCategory ? "Tipe Salah" : "Tidak Ditemukan",
                inline: true,
              },
            )
            .setTimestamp()
            .setFooter({
              text: `Diminta oleh ${message.author.tag} • ExtremesID Control Panel`,
              iconURL: message.author.displayAvatarURL(),
            });

          console.error(
            `❌ [CONFIG ERROR] Ticket category issue detected by ${message.author.tag}`,
          );
          return message.reply({ embeds: [errorEmbed] });
        }

        const channelsInTicketCategory = ticketCategory.children.cache
          .filter((c) => c.type === ChannelType.GuildText)
          .sort((a, b) => a.position - b.position);

        const controlEmbed = new EmbedBuilder()
          .setColor("#4B0082")
          .setTitle("🎛️ Control Panel - Status AI")
          .setDescription(`**Kategori Tiket:** ${ticketCategory.name}`)
          .setThumbnail(message.guild.iconURL())
          .setTimestamp()
          .setFooter({
            text: `Diminta oleh ${message.author.tag} • Page 1/1`,
            iconURL: message.author.displayAvatarURL(),
          });

        if (channelsInTicketCategory.size === 0) {
          controlEmbed.addFields({
            name: "Status Channel",
            value: "Tidak ada channel tiket aktif saat ini.",
          });
        } else {
          const channelStatuses = channelsInTicketCategory
            .map((channel) => {
              const status = AI_PAUSE_STATUS.get(channel.id)
                ? "⏸️ Dinonaktifkan"
                : "▶️ Aktif";
              return `• ${channel} (${channel.name}): **${status}**`;
            })
            .join("\n");

          controlEmbed.addFields(
            { name: "Channel Aktif", value: channelStatuses },
            {
              name: "Penggunaan Command",
              value: [
                "```" + `${COMMAND_PREFIX} control ai-stop #channel` + "```",
                "```" + `${COMMAND_PREFIX} control ai-play #channel` + "```",
                "",
                "**Keterangan:**",
                "`ai-stop` - Menonaktifkan AI di channel tertentu",
                "`ai-play` - Mengaktifkan kembali AI di channel tertentu",
              ].join("\n"),
            },
          );
        }

        return message.reply({ embeds: [controlEmbed] });
      } else if (args[0] === "ai-stop" || args[0] === "ai-play") {
        const channelMention = args[1];
        const targetChannelId = channelMention?.replace(/[<#>]/g, "");

        if (!targetChannelId) {
          const usageEmbed = new EmbedBuilder()
            .setColor("#FFA500")
            .setTitle("❌ Penggunaan Salah")
            .setDescription("Format command tidak valid.")
            .addFields(
              {
                name: "Contoh Penggunaan",
                value: `\`${COMMAND_PREFIX} control ${args[0]} #channel\``,
              },
              { name: "Command", value: args[0], inline: true },
              { name: "Channel", value: "Tidak disebutkan", inline: true },
            )
            .setTimestamp();

          console.log(
            `⚠️ [INVALID USAGE] ${message.author.tag} salah menggunakan command "${command} ${args.join(" ")}"`,
          );
          return message.reply({ embeds: [usageEmbed] });
        }

        const targetChannel = message.guild.channels.cache.get(targetChannelId);
        const isValidChannel =
          targetChannel?.parentId === TICKET_CATEGORY_ID &&
          targetChannel?.type === ChannelType.GuildText;

        if (!isValidChannel) {
          const errorEmbed = new EmbedBuilder()
            .setColor("#FF4444")
            .setTitle("🚫 Channel Tidak Valid")
            .setDescription(
              "Channel yang dimaksud bukan bagian dari kategori tiket.",
            )
            .addFields(
              {
                name: "Channel Target",
                value: `<#${targetChannelId}>`,
                inline: true,
              },
              {
                name: "Kategori Tiket",
                value: TICKET_CATEGORY_ID,
                inline: true,
              },
            )
            .setTimestamp();

          console.log(
            `❌ [INVALID CHANNEL] ${message.author.tag} mencoba mengontrol AI di channel yang salah (${targetChannelId})`,
          );
          return message.reply({ embeds: [errorEmbed] });
        }

        const action = args[0] === "ai-stop";
        AI_PAUSE_STATUS.set(targetChannel.id, action);
        await savePauseStatus();

        const statusEmbed = new EmbedBuilder()
          .setColor(action ? "#FFA500" : "#00FF00")
          .setTitle(action ? "⏸️ AI Dinonaktifkan" : "▶️ AI Diaktifkan")
          .setDescription(
            `Status AI Luckie berhasil diubah di ${targetChannel}`,
          )
          .addFields(
            { name: "Channel", value: targetChannel.toString(), inline: true },
            {
              name: "Status",
              value: action ? "Paused" : "Active",
              inline: true,
            },
            { name: "Admin", value: message.author.toString(), inline: true },
          )
          .setTimestamp()
          .setFooter({
            text: "ExtremesID AI Control • " + new Date().toLocaleString(),
            iconURL: message.guild.iconURL(),
          });

        console.log(
          `🔄 [AI STATUS CHANGE] ${message.author.tag} ${action ? "menonaktifkan" : "mengaktifkan"} AI di ${targetChannel.name} (${targetChannel.id})`,
        );
        return message.reply({ embeds: [statusEmbed] });
      }
    }

    // Unknown command handler
    if (content.startsWith(COMMAND_PREFIX)) {
      const unknownCmdEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("❌ Command Tidak Dikenal")
        .setDescription(`Command \`${command}\` tidak valid.`)
        .addFields(
          {
            name: "Command Tersedia",
            value: `\`${COMMAND_PREFIX} control\``,
            inline: true,
          },
          { name: "Pengguna", value: message.author.tag, inline: true },
        )
        .setTimestamp();

      console.log(
        `❓ [UNKNOWN COMMAND] ${message.author.tag} mencoba menjalankan command tidak dikenal: "${command}"`,
      );
      return message.reply({ embeds: [unknownCmdEmbed] });
    }
  }
  // --- END: Command Handling ---

  // Jika pesan tidak dimulai dengan COMMAND_PREFIX dan bukan di kategori tiket, abaikan
  if (message.channel.parentId !== TICKET_CATEGORY_ID) return;

  // Cek apakah AI sedang dipause di channel ini
  if (AI_PAUSE_STATUS.get(message.channel.id) === true) {
    return; // AI dipause, jangan merespons
  }

  try {
    const [data, promptTemplate] = await Promise.all([
      getStockData(),
      getTemplatePrompt(),
    ]);

    if (!data || !data.categories) {
      // Pengecekan tambahan untuk struktur dataStock.json
      console.error("dataStock.json is empty or malformed:", data);
      return await message.reply(
        "Maaf kak, data stok layanan tidak tersedia atau formatnya salah. Silakan hubungi admin.",
      );
    }

    const intent = analyzeIntent(content, data);

    // Prioritaskan respons dari fungsi generateFormattedReply
    // Hanya panggil jika ada intent spesifik (bukan 'general') atau jika category/plan terdeteksi
    if (intent.queryType !== "general" || (intent.category && intent.plan)) {
      const reply = await generateFormattedReply(content, username, data);
      return await message.reply(reply);
    }

    // Jika tidak ada intent spesifik dan queryType adalah "general", fallback ke Gemini AI generik
    const messages = await message.channel.messages.fetch({ limit: 10 });
    const conversation = Array.from(messages.values())
      .reverse()
      .map((m) => `${m.author.username}: ${m.content}`)
      .join("\n");

    // Persiapkan data stok yang lebih kaya untuk prompt Gemini
    const stockDataForGemini = Object.entries(data.categories)
      .map(([catKey, catValue]) => {
        let categoryInfo = `- **${catKey.toUpperCase()}**:\n`;
        const plansInfo = Object.entries(catValue.detail)
          .map(([planKey, planDetail]) => {
            const { isAvailable, summaryRam } = checkStockAvailability(
              catKey,
              planKey,
              data,
            ); // Mendapatkan status dan RAM summary
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

    const prompt = `${promptTemplate}\n\nData Harga & Stok Layanan ExtremesID:\n${stockDataForGemini}\n\nPercakapan:\n${conversation}\nLuckie:`;

    const result = await model.generateContent(prompt);
    let reply = result.response.text().trim();

    // Pencegahan pengulangan "Halo kak"
    if (!/^halo kak/i.test(reply)) {
      reply = `Halo kak **${username}**! ` + reply;
    }

    // Pencegahan pengulangan kalimat penutup dan memastikan hanya satu kali muncul
    const closingSentence = `\n\n💬 Kalau ada yang ingin ditanyakan lagi, langsung aja ya kak!`;
    if (!reply.includes(closingSentence.trim())) {
      reply = reply
        .replace(/kalau ada yang mau ditanyakan lagi, jangan ragu ya!/gi, "") // Sudah ada
        .trim();
      reply = reply.replace(/ada lagi yang bisa luckie bantu\?/gi, "").trim(); // Tambahkan ? untuk mencocokkan pertanyaan
      reply = reply.replace(/jangan ragu untuk bertanya lagi\./gi, "").trim(); // Tambahkan \. untuk mencocokkan titik
      reply = reply.replace(/perlu info lain, kak\?/gi, "").trim(); // Tambahkan jika ada variasi ini
      reply = reply
        .replace(/mau sekalian dicekin harganya juga\?/gi, "")
        .trim(); // Tambahkan jika ada variasi ini
      reply += closingSentence;
    }

    await message.reply(reply);
  } catch (err) {
    console.error("Error:", err);
    await message.reply(
      "Maaf kak, ada gangguan teknis. Kontak admin ya: https://wa.me/+6288987416154",
    );
  }
});

client.login(DISCORD_TOKEN);
