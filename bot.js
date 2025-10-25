// ================================
// ERLC Discord Audio Bot (Render)
// ================================

// ----- Imports -----
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";

// ----- Setup -----
const app = express();
app.use(cors());
app.use(express.json());

// ===== Gedeelde data (centrale opslag) =====
let activeDepartures = []; // [{ routeName, driver, departTime }]

// ----- Discord Setup -----
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID; // <-- Zet dit in Render Environment
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let voiceConnection = null;
let audioPlayer = createAudioPlayer();

// Mapping van routes naar voicekanalen
const ROUTE_CHANNELS = {
  "Lijn 6": "lijn 70 (dont delete)", // Vul je kanaalnaam hier in
};

// 🔊 Functie om verbinding te maken met voice channel
async function connectToVoice(routeName) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channelName = ROUTE_CHANNELS[routeName];
    const channel = guild.channels.cache.find(c => c.name === channelName && c.isVoiceBased());

    if (!channel) {
      console.log(`⚠️ Geen voicekanaal gevonden voor ${routeName}`);
      return null;
    }

    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    console.log(`🎧 Verbonden met ${channel.name}`);
    return voiceConnection;
  } catch (err) {
    console.error("❌ Voice connect error:", err);
    return null;
  }
}

// 🔊 Functie om audio af te spelen
function playAudio(stationName, isLast = false) {
  const basePath = path.resolve("./audio");
  const cleanName = stationName.toLowerCase().replace(/\s+/g, "_");
  const filePath = path.join(basePath, `${cleanName}.mp3`);
  const lastPath = path.join(basePath, "last_station.mp3");

  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      const resource = createAudioResource(filePath);
      audioPlayer.play(resource);
      console.log(`🎵 Playing ${cleanName}.mp3`);
    } else {
      console.log(`⚠️ Audio bestand niet gevonden: ${filePath}`);
    }

    if (isLast) {
      setTimeout(() => {
        if (fs.existsSync(lastPath)) {
          const resource = createAudioResource(lastPath);
          audioPlayer.play(resource);
          console.log("🎵 Playing last_station.mp3");
        } else {
          console.log("⚠️ Geen last_station.mp3 gevonden");
        }
      }, 7000);
    }
  }, 10000); // 10 seconden vertraging
}

// ====== Express API ======

// 📥 Ontvangen van “next station” verzoek
app.post("/next-station", async (req, res) => {
  const { routeName, stationName, isLast } = req.body;
  console.log(`➡️ Next station request: ${routeName} -> ${stationName}`);

  try {
    if (!voiceConnection) await connectToVoice(routeName);
    if (voiceConnection) {
      playAudio(stationName, isLast);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Kon niet verbinden met voicekanaal" });
    }
  } catch (err) {
    console.error("❌ Error handling next-station:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📤 Ontvangen wanneer een chauffeur een route laadt of vertrekt
app.post("/api/departures", (req, res) => {
  const { routeName, driver, departTime } = req.body;
  if (!routeName || !driver || !departTime)
    return res.status(400).json({ error: "Missing fields" });

  // Als de route al bestaat → update hem
  const existing = activeDepartures.find(r => r.routeName === routeName);
  if (existing) {
    existing.driver = driver;
    existing.departTime = departTime;
  } else {
    activeDepartures.push({ routeName, driver, departTime });
  }

  console.log(`🚌 ${driver} vertrekt met ${routeName} om ${departTime}`);
  res.json({ success: true });
});

// 📥 Ophalen van vertrektijden
app.get("/api/departures", (req, res) => {
  res.json(activeDepartures);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot web server running on port ${PORT}`));

// Discord login
client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(DISCORD_TOKEN);









