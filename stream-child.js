const { Client, StageChannel } = require("discord.js-selfbot-v13");
const { Streamer, prepareStream, playStream, Utils } = require("@dank074/discord-video-stream");
const config = require("./config.json");

const client = new Client({ checkUpdate: false });
const streamer = new Streamer(client);

process.on("message", async playbackCtx => {
  console.debug("[stream-child] Received playbackCtx:", playbackCtx);

  try {
    await client.login(config.token);
    console.debug("[stream-child] Logged in");

    const { guildId, channelId } = playbackCtx.voiceChannel;
    console.debug("[stream-child] Joining VC", guildId, channelId);
    await streamer.joinVoice(guildId, channelId);

    const vc = streamer.client.user.voice.channel;
    if (vc instanceof StageChannel) {
      await client.user.voice?.setSuppressed(false);
    }

    const season = playbackCtx.currentSeason + 1;
    const episode = playbackCtx.currentEpisode + 1;
    const item = playbackCtx.seasons[playbackCtx.currentSeason].episodes[playbackCtx.currentEpisode];
    console.debug(`[stream-child] Streaming S${season}E${episode}:`, item.title);

    // Signal Go-Live
    streamer.signalVideo(guildId, channelId, true);
    console.debug("[stream-child] signalVideo(true)");

    const controller = new AbortController();
    const { command, output } = prepareStream(
      item.filePath,
      {
        width: config.streamOpts.width,
        height: config.streamOpts.height,
        frameRate: config.streamOpts.fps,
        bitrateVideo: config.streamOpts.bitrateKbps,
        bitrateVideoMax: config.streamOpts.maxBitrateKbps,
        hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
        videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec),
        includeAudio: true,
        audioCodec: "libopus",
        audioBitrate: config.audioBitrateKbps
      },
      controller.signal
    );

    command.on("start", cmdLine => console.debug("[stream-child][ffmpeg] start:", cmdLine));
    command.on("error", err => console.error("[stream-child][ffmpeg] error:", err));
    command.on("end", () => console.debug("[stream-child][ffmpeg] end"));

    console.debug("[stream-child] Calling playStream");
    await playStream(output, streamer, { type: "go-live" }, controller.signal);
    console.debug("[stream-child] playStream completed");

  } catch (err) {
    console.error("[stream-child] Uncaught error:", err);
  } finally {
    try {
      console.debug("[stream-child] Cleaning up");
      const { guildId, channelId } = playbackCtx.voiceChannel;
      streamer.signalVideo(guildId, channelId, false);
      streamer.leaveVoice();
    } catch (e) {
      console.error("[stream-child] Cleanup error:", e);
    }
    console.debug("[stream-child] Exiting");
    process.exit(0);
  }
});
