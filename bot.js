// ================================
// ERLC Discord Audio Bot (Render)
// ================================

// ----- Imports -----
import express from "express";
import cors from "cors";
import fs from "fs";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());
app.use(express.json());

let activeDepartures = []; // gedeelde data voor alle gebruikers


// ----- Config -----
const TOKEN = process.env.DISCORD_BOT_TOKEN; // set this in Render Environment
const GUILD_ID = process.env.GUILD_ID;       // your Discord server ID
const PORT = process.env.PORT || 3000;

// 🚍 Which Discord voice channel each route uses
const ROUTE_CHANNELS = {
  "Lijn 6": "1430272873037168821",     // example: 1386237181189468192
  "Lijn 12": "1430272873037168821",
  "FastLine": "1430272873037168821",
};

// ----- Discord client setup -----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.on("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);

// Utility
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ----- Endpoint -----
app.post("/next-station", async (req, res) => {
  try {
    const { routeName, stationName } = req.body;
    console.log(`➡️ Next station request: ${routeName} -> ${stationName}`);

    if (!routeName || !stationName) {
      console.warn("⚠️ Missing route or station name in request");
      return res.status(400).send("Missing route or station name");
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error("Guild not found");
      return res.status(404).send("Guild not found");
    }

    // Get voice channel for route
    const channelId = ROUTE_CHANNELS[routeName];
    if (!channelId) {
      console.warn(`⚠️ No voice channel configured for ${routeName}`);
      return res.status(404).send("No voice channel configured");
    }

    // Connect to voice
    console.log(`🎧 Connecting to voice channel for ${routeName}...`);
    const connection = joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`🎧 Connected to ${guild.channels.cache.get(channelId)?.name}`);
    });

    // Create audio player
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Normalize filename
    const baseName = stationName.toLowerCase().replace(/\s+/g, "_");
    const nextFile = `audio/${baseName}.mp3`;
    const lastFile = `audio/last_station.mp3`;

    // Wait 10 seconds before playing
    console.log(`⏳ Waiting 10 seconds before announcing ${stationName}...`);
    await wait(10000);

    // Play next station audio
    if (!fs.existsSync(nextFile)) {
      console.warn(`⚠️ Audio not found: ${nextFile}`);
      return res.status(404).send("Audio not found");
    }
    console.log(`🎵 Playing ${nextFile}`);
    const nextResource = createAudioResource(fs.createReadStream(nextFile));
    player.play(nextResource);

    // When finished, maybe play last-station message
    player.once(AudioPlayerStatus.Idle, async () => {
      const routeStops = {
        "Lijn 6": ["Spawn", "Fire department", "Central park", "Transferium"],
        "Line A": ["Spawn", "Fire Department", "Central Park", "Farms"],
        "Line C": ["Spawn", "Chinatown", "Hospital", "Highrock"],
        "FastLine": ["Springfield", "River City"],
      };

      const stops = routeStops[routeName] || [];
      const lastStop = stops[stops.length - 1]?.toLowerCase().replace(/\s+/g, "_");

      if (baseName === lastStop && fs.existsSync(lastFile)) {
        console.log("🚏 This is the last station — playing last_station.mp3");
        const lastResource = createAudioResource(fs.createReadStream(lastFile));
        player.play(lastResource);
        player.once(AudioPlayerStatus.Idle, () => {
          console.log("👋 Disconnecting after last station");
          connection.destroy();
        });
      } else {
        console.log("✅ Finished playing station audio");
        connection.destroy();
      }
    });

    res.send("OK");
  } catch (err) {
    console.error("❌ Error handling next-station:", err);
    res.status(500).send("Internal server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot web server running on port ${PORT}`));


// ===== Vertrektijden API =====
app.get("/departures", (req, res) => {
  res.json(activeDepartures);
});

app.post("/departures", (req, res) => {
  const { line, stop, time } = req.body;
  if (!line || !time) return res.status(400).json({ error: "Missing data" });

  // lijn updaten of toevoegen
  activeDepartures = activeDepartures.filter(d => d.line !== line);
  activeDepartures.push({ line, stop, time });
  console.log("🚍 Nieuw vertrek:", line, "->", stop, time);
  res.json({ success: true });
});



client.login(TOKEN);








