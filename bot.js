import express from "express";
import cors from "cors";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ES module helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express setup
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

let voiceConnection = null;
let audioPlayer = createAudioPlayer();

// Route-to-channel map
// Map route names (from your HTML) to Discord voice channel IDs
const VOICE_CHANNELS = {
  "Lijn 6": "1430272873037168821",
  "Lijn 70": "1430272873037168821",
  "Lijn 7 Shuttlebus": "1430272873037168821",
  "Lijn 8 Shuttlebus": "1430272873037168821",
  "Lijn 9": "1430272873037168821",
  "FastLine": "1430272873037168821"
};


// Discord login
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(TOKEN);

// Connect to VC
async function connectToChannel(routeName) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channelId = ROUTE_CHANNELS[routeName];
    if (!channelId) {
      console.log(`⚠️ No voice channel configured for ${routeName}`);
      return;
    }

    const channel = await guild.channels.fetch(channelId);
    if (!channel) {
      console.log(`⚠️ Channel ${channelId} not found`);
      return;
    }

    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });
    console.log(`🎧 Connected to ${channel.name}`);
  } catch (err) {
    console.error("❌ Voice connect error:", err);
  }
}

// POST /next-station
app.post("/next-station", async (req, res) => {
  const { routeName, station } = req.body;
  if (!routeName || !station) {
    return res.status(400).json({ success: false, message: "Missing routeName or station" });
  }

  console.log(`➡️ Next station: ${routeName} -> ${station}`);

  await connectToChannel(routeName);

  const audioDir = path.join(__dirname, "audio");
  const filePath = path.join(audioDir, `${station.toLowerCase()}.mp3`);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Missing audio for ${station}`);
    return res.status(404).json({ success: false, message: `No audio file for ${station}` });
  }

  try {
    const resource = createAudioResource(filePath);
    audioPlayer.play(resource);
    voiceConnection.subscribe(audioPlayer);

    audioPlayer.once(AudioPlayerStatus.Idle, () => {
      console.log(`✅ Finished playing ${station}`);
    });

    res.json({ success: true, message: `Playing ${station}` });
  } catch (err) {
    console.error("❌ Error playing:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /
app.get("/", (req, res) => {
  res.send("🎵 ERLC Bot is running — send POST to /next-station");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
});

