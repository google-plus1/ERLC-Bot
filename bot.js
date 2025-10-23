// ========================================
// ERLC Discord Audio Bot (Final Fixed Version)
// ========================================

import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from "@discordjs/voice";
import 'libsodium-wrappers';
import fs from "fs";
import path from "path";

// --------------------------
// CONFIG
// --------------------------
const TOKEN = process.env.DISCORD_BOT_TOKEN; // your bot token (Render env var)
const GUILD_ID = process.env.GUILD_ID; // your Discord server ID (Render env var)
const PORT = process.env.PORT || 3000;

// Match your ERLC routes to Discord voice channels
const ROUTE_CHANNELS = {
  "Lijn 6": "lijn 70 (dont delete)",
  "Line A": "lijn 70 (dont delete)",
  "Line C": "lijn 70 (dont delete)",
  "FastLine": "lijn 70 (dont delete)",
};

// --------------------------
// DISCORD CLIENT SETUP
// --------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --------------------------
// EXPRESS SERVER SETUP
// --------------------------
const app = express();
app.use(cors()); // allow Netlify to connect
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ ERLC Discord Bot is running.");
});

// Endpoint for "Next Station"
app.post("/next-station", async (req, res) => {
  try {
    const { routeName, stationName } = req.body;

    if (!routeName || !stationName) {
      console.log("⚠️ Missing routeName or stationName in request");
      return res.status(400).json({ error: "Missing routeName or stationName" });
    }

    console.log(`➡️ Next station request: ${routeName} -> ${stationName}`);

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.log("❌ Guild not found. Check GUILD_ID.");
      return res.status(404).json({ error: "Guild not found" });
    }

    const channelName = ROUTE_CHANNELS[routeName];
    if (!channelName) {
      console.log(`⚠️ No channel configured for route: ${routeName}`);
      return res.status(404).json({ error: "Voice channel not configured" });
    }

    const voiceChannel = guild.channels.cache.find(
      (ch) => ch.name === channelName && ch.type === 2
    );

    if (!voiceChannel) {
      console.log(`⚠️ Voice channel not found: ${channelName}`);
      return res.status(404).json({ error: "Voice channel not found" });
    }

    // Connect to the voice channel
    console.log(`🎧 Connecting to ${channelName}...`);
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    // Find the right audio file
    const audioFile = stationName.toLowerCase().replace(/\s+/g, "_") + ".mp3";
    const filePath = path.resolve(`./audio/${audioFile}`);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Audio file not found: ${filePath}`);
      return res.status(404).json({ error: "Audio file not found" });
    }

    console.log(`🎵 Playing audio: ${audioFile}`);
    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("✅ Finished playing audio, disconnecting...");
      connection.destroy();
    });

    res.json({ success: true, message: `Playing ${stationName}` });
  } catch (error) {
    console.error("❌ Error processing /next-station:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------------
// START EVERYTHING
// --------------------------
app.listen(PORT, () => {
  console.log(`🚀 Bot web server running on port ${PORT}`);
});

client.login(TOKEN);
