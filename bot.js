// =============================
// ERLC Discord Audio Bot
// =============================
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";

// ✅ Dynamic CORS import fix (for Render)
let cors;
try {
  cors = (await import("cors")).default;
} catch (e) {
  console.error("⚠️ CORS not found, continuing without it...");
}

// =============================
// Setup
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
if (cors) app.use(cors());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_BOT_TOKEN;   // put your bot token in Render environment variable
const GUILD_ID = process.env.GUILD_ID;         // your Discord server ID
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID; // your “lijn 70” channel ID

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =============================
// Audio player setup
// =============================
const player = createAudioPlayer();

player.on(AudioPlayerStatus.Playing, () => console.log("🎵 Now playing..."));
player.on(AudioPlayerStatus.Idle, () => console.log("✅ Audio finished"));
player.on("error", err => console.error("❌ Player error:", err));

// =============================
// Join Voice Channel
// =============================
async function connectToChannel() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);
  if (!channel) throw new Error("⚠️ Voice channel not found!");
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator
  });
  connection.subscribe(player);
  console.log(`🎧 Connected to ${channel.name}`);
  return connection;
}

// =============================
// Play Station Audio
// =============================
async function playStationAudio(stationName) {
  const filePath = path.join(__dirname, "audio", `${stationName.toLowerCase().replace(/\s+/g, "_")}.mp3`);
  console.log(`🎵 Attempting to play: ${filePath}`);

  try {
    const resource = createAudioResource(filePath);
    player.play(resource);
  } catch (err) {
    console.error(`⚠️ Audio file not found or failed: ${filePath}`);
  }
}

// =============================
// Express endpoint
// =============================
// Website sends a POST request like:
// fetch("https://YOUR_RENDER_URL/next-station", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ routeName: "Line A", stationName: "Spawn" })
// })

app.post("/next-station", async (req, res) => {
  const { routeName, stationName } = req.body;
  console.log(`➡️ Next station request: ${routeName} -> ${stationName}`);

  try {
    let connection = getVoiceConnection(GUILD_ID);
    if (!connection) {
      console.log("🎧 Connecting to voice...");
      connection = await connectToChannel();
    }

    if (stationName) await playStationAudio(stationName);
    res.json({ success: true, message: `Played ${stationName}` });
  } catch (err) {
    console.error("❌ Error handling request:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get("/", (req, res) => res.send("✅ ERLC Bot is running!"));

// =============================
// Start Server + Discord Bot
// =============================
app.listen(PORT, () => console.log(`🚀 Bot web server running on port ${PORT}`));

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
