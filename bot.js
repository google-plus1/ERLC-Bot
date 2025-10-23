// bot.js — ERLC Discord Audio Bot (Render version)
const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
} = require("@discordjs/voice");

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// 🧩 CONFIG (Render automatically provides these via Environment Variables)
const DISCORD_TOKEN = process.env.MTQzMDI1MjUwMTMxNTA5MjYwMg.GdqNQ8.RE6N2Ey66aV2CnvrnaX_b9JNW8SU2GEaAX7ovI;
const GUILD_ID = process.env.1386264143916695625;
const VOICE_CHANNEL_ID = process.env.1430272873037168821;

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// 🌍 Root route (so Render health check passes)
app.get("/", (req, res) => {
  res.send("ERLC Discord Bot running on Render ✅");
});

// 🎧 Play audio when called from website
app.post("/next-station", async (req, res) => {
  const { station } = req.body;
  console.log(`➡️ Next station requested: ${station}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);

    if (!channel) {
      console.error("❌ Voice channel not found");
      return res.status(404).send("Voice channel not found");
    }

    let connection = getVoiceConnection(GUILD_ID);
    if (!connection) {
      connection = joinVoiceChannel({
        channelId: VOICE_CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
      });
    }

    const player = createAudioPlayer();
    const resource = createAudioResource(`./audio/${station}.mp3`);
    connection.subscribe(player);
    player.play(resource);

    player.once(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    res.send("Audio played successfully");
  } catch (error) {
    console.error("❌ Error playing audio:", error);
    res.status(500).send("Failed to play audio");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));

client.login(DISCORD_TOKEN);
