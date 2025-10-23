import express from "express";
import cors from "cors";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import path from "path";
import fs from "fs";

// ------------------------------
// Config & Setup
// ------------------------------
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;          // Your bot token (Render env)
const GUILD_ID = process.env.GUILD_ID;    // Your Discord server ID (Render env)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let voiceConnection = null;
let audioPlayer = createAudioPlayer();

// ------------------------------
// Voice Channel Mapping
// ------------------------------
const ROUTE_CHANNELS = {
  "Line A": "1430272873037168821",
  "Line C": "1430272873037168821",
  "FastLine": "1430272873037168821"
};

// ------------------------------
// Discord Bot Initialization
// ------------------------------
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);

// ------------------------------
// Helper to auto join correct VC
// ------------------------------
async function ensureConnected(routeName) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channelId = ROUTE_CHANNELS[routeName];
    if (!channelId) {
      console.log(`⚠️ No voice channel configured for ${routeName}`);
      return null;
    }

    const channel = await guild.channels.fetch(channelId);
    if (!channel) {
      console.log(`⚠️ Channel ID ${channelId} not found for ${routeName}`);
      return null;
    }

    if (voiceConnection) {
      try {
        voiceConnection.destroy();
      } catch (err) {
        console.warn("⚠️ Error disconnecting old connection:", err.message);
      }
    }

    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });

    console.log(`🎧 Joined voice channel for ${routeName}: ${channel.name}`);
    return voiceConnection;
  } catch (err) {
    console.error("❌ Error joining channel:", err);
    return null;
  }
}

// ------------------------------
// Endpoint: Play Next Station
// ------------------------------
app.post("/next-station", async (req, res) => {
  const { routeName, station } = req.body;
  console.log("➡️ Next station request:", routeName, station);
  ...
});


  console.log(`➡️ Next station request for ${routeName}: ${station}`);

  // Make sure we're connected to the right channel
  await ensureConnected(routeName);

  // Path to your MP3s (must be uploaded in Render repo under /audio)
  const audioDir = path.join(process.cwd(), "audio");
  const filePath = path.join(audioDir, `${station.toLowerCase()}.mp3`);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Audio file not found for station: ${station}`);
    return res.status(404).json({ success: false, message: `No audio file for ${station}` });
  }

  try {
    const resource = createAudioResource(filePath);
    audioPlayer.play(resource);
    voiceConnection.subscribe(audioPlayer);

    audioPlayer.once(AudioPlayerStatus.Idle, () => {
      console.log(`✅ Finished announcement: ${station}`);
    });

    res.json({ success: true, message: `Playing audio for ${station}` });
  } catch (err) {
    console.error("❌ Error playing audio:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------
// Endpoint: Root (for testing)
// ------------------------------
app.get("/", (req, res) => {
  res.send("🎵 ERLC Discord Bot server is running!");
});

// ------------------------------
// Start the web server
// ------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
});

