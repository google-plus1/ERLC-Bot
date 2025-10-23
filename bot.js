// ==========================
// ERLC Discord Audio Bot
// ==========================

import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection
} from "@discordjs/voice";
import 'libsodium-wrappers';
import fs from "fs";
import path from "path";

// --------------------------
// CONFIG
// --------------------------
const TOKEN = process.env.DISCORD_BOT_TOKEN; // set in Render environment variables
const GUILD_ID = process.env.GUILD_ID; // your Discord server ID
const PORT = process.env.PORT || 3000;

// Route names to Discord channel names (exact spelling)
const ROUTE_CHANNELS = {
  "Lijn 6": "lijn 70 (dont delete)",
  "Line A": "lijn 70 (dont delete)",
  "Line C": "lijn 70 (dont delete)",
  "FastLine": "lijn 70 (dont delete)"
};

// --------------------------
// DISCORD CLIENT
// --------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --------------------------
// EXPRESS APP
// --------------------------
const app = express();
app.use(express.json());

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ ERLC Discord Bot is running");
});

// 🎵 Endpoint called by your website
app.post("/next-station", async (req, res) => {
  try {
    const { routeName, stationName } = req.body;
    console.log(`➡️ Next station request: ${routeName} -> ${stationName}`);

    if (!routeName || !stationName) {
      console.warn("⚠️ Missing routeName or stationName");
      return res.status(400).json({ error: "Missing routeName or stationName" });
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const channelName = ROUTE_CHANNELS[routeName];
    if (!channelName) {
      console.warn(`⚠️ No voice channel configured for ${routeName}`);
      return res.status(404).json({ error: "Voice channel not configured" });
    }

    const voiceChannel = guild.channels.cache.find(
      (ch) => ch.name === channelName && ch.type === 2
    );
    if (!voiceChannel) {
      console.warn(`⚠️ Voice channel not found: ${channelName}`);
      return res.status(404).json({ error: "Voice channel not found" });
    }

    // Join channel
    console.log(`🎧 Connecting to ${channelName}...`);
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });

    // Play audio
    const audioFile = stationName.toLowerCase().replace(/\s+/g, "_") + ".mp3";
    const filePath = path.resolve(`./audio/${audioFile}`);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Audio file not found: ${filePath}`);
      return res.status(404).json({ error: "Audio file not found" });
    }

    console.log(`🎵 Playing ${audioFile}`);
    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("✅ Finished playing audio");
      connection.destroy();
    });

    res.json({ success: true, message: `Playing ${stationName}` });
  } catch (err) {
    console.error("❌ Error in /next-station:", err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------
// START SERVER
// --------------------------
app.listen(PORT, () => {
  console.log(`🚀 Bot web server running on port ${PORT}`);
});

client.login(TOKEN);
