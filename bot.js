// =======================================
// ERLC Discord Audio Bot
// =======================================
import express from "express";
import fs from "fs";
import path from "path";
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
  AudioPlayerStatus,
  getVoiceConnection,
} from "@discordjs/voice";
import cors from "cors";

// =======================================
// Basic setup
// =======================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// =======================================
// Discord bot setup
// =======================================
const TOKEN = process.env.DISCORD_TOKEN || "MTQzMDI1MjUwMTMxNTA5MjYwMg.GdqNQ8.RE6N2Ey66aV2CnvrnaX_b9JNW8SU2GEaAX7ovI";
const GUILD_ID = process.env.GUILD_ID || "1386264143916695625";

// create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// =======================================
// Voice channel map (edit these names!)
// =======================================
// Route name → voice channel name (MUST MATCH your Discord VC)
const ROUTE_CHANNELS = {
  "Lijn 1": "lijn 70 (dont delete)",
  "Lijn 2": "lijn 70 (dont delete)",
  "Lijn 3": "lijn 70 (dont delete)",
  "Lijn 4": "lijn 70 (dont delete)",
  "Lijn 5": "lijn 70 (dont delete)",
  "Lijn 6": "lijn 70 (dont delete)",
};

// =======================================
// Function: connect and play audio
// =======================================
async function playStationAudio(route, station) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channelName = ROUTE_CHANNELS[route];

    if (!channelName) {
      console.warn(`⚠️ No voice channel configured for ${route}`);
      return { ok: false, message: `No voice channel for ${route}` };
    }

    const channel = guild.channels.cache.find(
      (ch) => ch.name.toLowerCase() === channelName.toLowerCase()
    );

    if (!channel) {
      console.warn(`⚠️ Channel "${channelName}" not found`);
      return { ok: false, message: `Channel not found` };
    }

    console.log(`🎧 Connecting to ${channel.name}`);
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    // find audio file
    const audioDir = path.join(__dirname, "audio");
    let filePath = path.join(audioDir, `${station.toLowerCase()}.mp3`);

    if (!fs.existsSync(filePath)) {
      const candidates = [
        path.join(audioDir, `${station}.mp3`),
        path.join(audioDir, `${station.toLowerCase().replace(/ /g, "_")}.mp3`),
        path.join(audioDir, `${station.toLowerCase().replace(/ /g, "-")}.mp3`)
      ];
      filePath = candidates.find((p) => fs.existsSync(p));
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`⚠️ Missing audio for ${station}`);
      return { ok: false, message: `Missing audio for ${station}` };
    }

    console.log(`🎵 Playing ${path.basename(filePath)}`);

    const resource = createAudioResource(filePath);
    const player = createAudioPlayer();
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("✅ Finished playing audio");
      player.stop();
      connection.destroy();
    });

    player.on("error", (error) => {
      console.error("Audio player error:", error);
      connection.destroy();
    });

    return { ok: true, message: "Playing audio" };

  } catch (error) {
    console.error("❌ Voice connect error:", error);
    return { ok: false, message: error.message };
  }
}

// =======================================
// Web endpoint: /next-station
// Called by your website when a driver clicks "Next Station"
// =======================================
app.post("/next-station", async (req, res) => {
  const { route, station } = req.body;

  console.log(`➡️ Next station: ${route} -> ${station}`);

  if (!route || !station) {
    return res.status(400).json({ error: "Missing route or station" });
  }

  const result = await playStationAudio(route, station);
  if (!result.ok) {
    return res.status(404).json({ error: result.message });
  }

  return res.json({ success: true, message: result.message });
});

// =======================================
// Root route
// =======================================
app.get("/", (req, res) => {
  res.send("✅ ERLC Discord Audio Bot is running!");
});

// =======================================
// Start the server
// =======================================
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});

// =======================================
// Discord login
// =======================================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
