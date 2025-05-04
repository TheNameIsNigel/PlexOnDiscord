const { fork } = require("child_process");
const path = require("path");
const { Client } = require("discord.js-selfbot-v13");
const axios = require("axios");
const config = require("./config.json");

const COMMANDS = ["!pplay", "!pnext", "!pback", "!pstop", "!pqp"];

let playbackCtx = null;
let streamProcess = null;

function killStreamer() {
  if (streamProcess) {
    console.debug(`[debug] Killing old stream-child (pid=${streamProcess.pid})`);
    streamProcess.kill("SIGKILL");
    streamProcess = null;
  }
}

function spawnStreamer() {
  if (!playbackCtx) return;
  const S = playbackCtx.currentSeason + 1;
  const E = playbackCtx.currentEpisode + 1;
  console.debug(`[debug] Spawning stream-child at Season ${S} Episode ${E}`);
  streamProcess = fork(
    path.join(__dirname, "stream-child.js"),
    [],
    { stdio: ["pipe","pipe","pipe","ipc"] }
  );
  streamProcess.on("message", m => console.debug("[stream-child]", m));
  streamProcess.on("exit", (code, sig) =>
    console.debug(`[debug] stream-child exited code=${code} signal=${sig}`)
  );
  streamProcess.send(playbackCtx);
}

const client = new Client({ checkUpdate: false });

client.on("ready", () => {
  console.debug("[debug] Bot ready as", client.user.tag);
});

client.on("messageCreate", async msg => {
  console.debug("[debug] Received from", msg.author.username, ":", msg.content);
  if (!config.acceptedAuthors.includes(msg.author.id)) return;

  const raw = msg.content.trim();
  const cmd = COMMANDS.find(c => raw.startsWith(c));
  if (!cmd) return;

  console.debug("[debug] Command:", cmd);
  const voice = msg.member?.voice.channel;
  if (cmd === "!pplay" && !voice) {
    return msg.reply("⚠️ Join a voice channel first!");
  }

  try {
    if (cmd === "!pplay") {
      const query = raw.slice(cmd.length).trim();
      if (!query) return msg.reply("❌ You must specify a title.");

      console.debug("[debug] Searching Plex for:", query);
      const { host, token } = config.plex;

      let resp = await axios.get(`${host}/search`, { params: { query, "X-Plex-Token": token } });
      let items = resp.data.MediaContainer?.Metadata || [];
      console.debug("[debug] /search returned", items.length);

      if (!items.length) {
        console.debug("[debug] Fallback to /library/search");
        resp = await axios.get(`${host}/library/search`, { params: { query, "X-Plex-Token": token } });
        items = resp.data.MediaContainer?.Metadata || [];
        console.debug("[debug] /library/search returned", items.length);
      }
      if (!items.length) {
        return msg.reply(`❌ No Plex item for "${query}"`);
      }

      const first = items[0];
      playbackCtx = {
        seasons: [],
        currentSeason: 0,
        currentEpisode: 0,
        voiceChannel: {
          guildId: voice.guild.id,
          channelId: voice.id
        }
      };

      if (first.type === "movie") {
        playbackCtx.seasons.push({
          title: first.title,
          episodes: [{ title: first.title, filePath: first.Media[0].Part[0].file }]
        });
      } else {
        const showKey = first.grandparentRatingKey || first.parentRatingKey || first.ratingKey;
        console.debug("[debug] Fetching seasons for showKey", showKey);
        const seasonsResp = await axios.get(
          `${host}/library/metadata/${showKey}/children`,
          { params: { "X-Plex-Token": token } }
        );
        const seasons = seasonsResp.data.MediaContainer?.Metadata || [];
        console.debug("[debug] Found", seasons.length, "seasons");

        for (const s of seasons) {
          console.debug("[debug] Season", s.index, "- fetching episodes");
          const epsResp = await axios.get(
            `${host}/library/metadata/${s.ratingKey}/children`,
            { params: { "X-Plex-Token": token } }
          );
          const eps = (epsResp.data.MediaContainer?.Metadata || []).sort((a,b) => a.index - b.index);
          const episodes = eps.map(ep => ({
            title: `${ep.grandparentTitle} S${String(ep.parentIndex).padStart(2,'0')}E${String(ep.index).padStart(2,'0')} – ${ep.title}`,
            filePath: ep.Media[0].Part[0].file
          }));
          playbackCtx.seasons.push({ title: `Season ${s.index}`, episodes });
        }

        if (first.type === "episode") {
          outer: for (let si = 0; si < playbackCtx.seasons.length; si++) {
            const eps = playbackCtx.seasons[si].episodes;
            for (let ei = 0; ei < eps.length; ei++) {
              if (eps[ei].title.includes(first.title)) {
                playbackCtx.currentSeason = si;
                playbackCtx.currentEpisode = ei;
                break outer;
              }
            }
          }
        }
      }

      const S0 = playbackCtx.currentSeason + 1;
      const E0 = playbackCtx.currentEpisode + 1;
      const nowTitle = playbackCtx.seasons[playbackCtx.currentSeason]
        .episodes[playbackCtx.currentEpisode].title;
      await msg.reply(`▶️ Now playing (S${S0}E${E0}): ${nowTitle}`);

      killStreamer();
      spawnStreamer();
    }

    else if (cmd === "!pnext" || cmd === "!pback") {
      console.debug("[debug] Skip:", cmd);
      if (!playbackCtx) return msg.reply("❌ Nothing playing.");
      const delta = cmd === "!pnext" ? 1 : -1;
      let { currentSeason: cs, currentEpisode: ce, seasons } = playbackCtx;
      ce += delta;
      if (ce < 0 && cs > 0) {
        cs--; ce = seasons[cs].episodes.length - 1;
      } else if (ce >= seasons[cs].episodes.length && cs < seasons.length - 1) {
        cs++; ce = 0;
      }
      if (cs < 0 || cs >= seasons.length) {
        return msg.reply("⚠️ No more items.");
      }
      playbackCtx.currentSeason = cs;
      playbackCtx.currentEpisode = ce;
      const S1 = cs + 1, E1 = ce + 1;
      const t1 = seasons[cs].episodes[ce].title;
      await msg.reply(`▶️ Now playing (S${S1}E${E1}): ${t1}`);

      killStreamer();
      spawnStreamer();
    }

    else if (cmd === "!pqp") {
      console.debug("[debug] pqp select");
      const parts = raw.slice(cmd.length).trim().split("-").map(x => parseInt(x, 10));
      let si = 0, ei = parts[0] - 1;
      if (parts.length > 1) {
        si = parts[0] - 1;
        ei = parts[1] - 1;
      }
      const seasons = playbackCtx?.seasons || [];
      if (!playbackCtx || si < 0 || si >= seasons.length ||
          ei < 0 || ei >= seasons[si].episodes.length) {
        return msg.reply("❌ Invalid selection.");
      }
      playbackCtx.currentSeason = si;
      playbackCtx.currentEpisode = ei;
      const S2 = si + 1, E2 = ei + 1;
      const t2 = seasons[si].episodes[ei].title;
      await msg.reply(`▶️ Now playing (S${S2}E${E2}): ${t2}`);

      killStreamer();
      spawnStreamer();
    }

    else if (cmd === "!pstop") {
      console.debug("[debug] pstop");
      killStreamer();
      await msg.reply("⏹ Stream stopped.");
    }
  } catch (err) {
    console.error("[error]", err);
    await msg.reply(`❌ ${err.message}`);
  }
});

client.login(config.token);
