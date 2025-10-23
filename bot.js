// =======================================
// ERLC Discord Audio Bot (Render Version)
// =======================================
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import {
  Client,
  GatewayIntentBits,
  Partials
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} from "@discordjs/voice";

// =======================================
// Basic setup
// =======================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error("❌ Missing DISCORD_TOKEN or GUILD_ID in environment variables!");
  process.exit(1);
}

// =======================================
// Discord bot setup
// =======================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// =======================================
// Route → voice channel mapping
// =======================================
// Make sure the channel names EXACTLY match your Discord server!
const ROUTE_CHANNELS = {
  "Line A": "lijn 70 (dont delete)",
  "Line C": "lijn 70 (dont delete)",
  "FastLine": "lijn 70 (dont delete)",
  "Lijn 6": "lijn 70 (dont delete)"
};

// =======================================
// Function to connect and play station audio
// =======================================
async function playStationAudio(route, station) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channelName = ROUTE_CHANNELS[route];

    if (!channelName) {
      console.warn(`⚠️ No voice channel mapped for ${route}`);
      return { ok: false, message: `No voice channel for ${route}` };
    }

    const channel = guild.channels.cache.find(
      ch => ch.name.toLowerCase() === channelName.toLowerCase()
    );

    if (!channel) {
      console.warn(`⚠️ Channel "${channelName}" not found`);
      return { ok: false, message: `Channel not found: ${channelName}` };
    }

    console.log(`🎧 Connecting to ${channel.name}...`);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    // Look for audio file
    const audioDir = path.join(__dirname, "audio");
    const cleanName = station.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const filePath = path.join(audioDir, `${cleanName}.mp3`);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Audio file not found: ${filePath}`);
      connection.destroy();
      return { ok: false, message: `Missing audio for ${station}` };
    }

    console.log(`🎵 Playing ${cleanName}.mp3`);

    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("✅ Finished playing audio");
      connection.destroy();
    });

    player.on("error", err => {
      console.error("Audio error:", err);
      connection.destroy();
    });

    return { ok: true, message: "Playing audio" };
  } catch (err) {
    console.error("❌ playStationAudio error:", err);
    return { ok: false, message: err.message };
  }
}

// =======================================
// Web endpoint — triggered from website
// =======================================
app.post("/next-station", async (req, res) => {
  try {
    const { route, station } = req.body;
    console.log(`➡️ Next station request: ${route} -> ${station}`);

    if (!route || !station)
      return res.status(400).json({ error: "Missing route or station" });

    const result = await playStationAudio(route, station);

    if (!result.ok) {
      return res.status(404).json({ error: result.message });
    }

    return res.json({ success: true, message: result.message });
  } catch (err) {
    console.error("❌ /next-station error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =======================================
// Root test endpoint
// =======================================
app.get("/", (req, res) => {
  res.send("✅ ERLC Discord Audio Bot is running and ready!");
});

// =======================================
// Start Express server
// =======================================
app.listen(PORT, () => {
  console.log(`🚀 Bot web server running on port ${PORT}`);
});

// =======================================
// Discord login
// =======================================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
