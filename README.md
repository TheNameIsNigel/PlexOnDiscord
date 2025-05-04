
# Plex on Discord

Discord self-bot that joins your voice channel and plays Plex movies or TV episodes (video + audio) with simple chat commands. Perfect for streaming your Plex library directly into any server you control.

---

## 🔑 Features

- **Search & Play**: `!pplay Agents of S.H.I.E.L.D ` finds movies or TV shows in Plex and starts streaming.  
- **Playlist Support**: For TV shows, builds a season playlist and auto-advances through episodes.  
- **Playback Controls**:  
  - `!prestart` – Restart the current item from the top  
  - `!ppause` – Pause the stream (video frame freezes)  
  - `!pnext` / `!pback` – Skip forward or back one episode  
  - `!pstop` – Stop streaming and disconnect  

---

## 🚀 Prerequisites

- **Node.js** v16 or newer  
- **FFmpeg** installed and available on your `PATH`  
- A **Plex Media Server** with an access token  

---

## 🛠 Installation

1. **Clone this repo**  
   ```bash
   git clone https://github.com/TheNameIsNigel/PlexOnDiscord.git
   cd PlexOnDiscord
``

2. **Install dependencies**

   ```bash
   npm update
   ```

3. **Create your config**

 Copy `config.example.json` to `config.json` and fill in your credentials (see below).

4. **Run the bot**

   ```bash
   npm start
   ```

---

## ⚙️ Configuration (`config.json`)
````
{
  "token": "YOUR_DISCORD_USER_TOKEN",
  "acceptedAuthors": ["YOUR_USER_ID"],
  "plex": {
    "host": "http://your.plex.server:32400",
    "token": "YOUR_PLEX_TOKEN"
  },
  "streamOpts": {
    "width": 1280,
    "height": 720,
    "fps": 15,
    "bitrateKbps": 1000,
    "maxBitrateKbps": 1200,
    "hardware_acceleration": true,
    "videoCodec": "h264"
  }
}
````
* **token**: Your Discord bot user token (has to be an actual Discord account, not a bot app)
* **acceptedAuthors**: Array of user IDs allowed to control the bot.
* **plex.host**: URL of your Plex server
* **plex.token**: Your Plex access token
* **streamOpts**: FFmpeg / stream settings

---

## 🎮 Usage

In any text channel:

!pplay <movie-or-show-name>   # Search Plex & start streaming
!prestart                     # Restart current movie/episode
!ppause                       # Pause the stream
!pnext                        # Next episode (TV only)
!pback                        # Previous episode (TV only)
!pstop                        # Stop streaming & leave VC

**Example**:

!pplay The Mandalorian
// → Joins your voice channel and plays S01 E01 of The Mandalorian
!pnext
// → Skips to S01E02
!ppause
// → Pauses the stream
!pstop
// → Stops & disconnects

---

## 🐛 Troubleshooting

* **No video/audio?**

  * Verify FFmpeg: `ffmpeg -version`
  * Check your Plex credentials and server URL.
* **Permissions errors?**

  * Ensure your bot account can join voice channels and go live.

---

## 🤝 Contributing

PRs and issues are welcome! Feel free to open a feature request or submit a bug-fix.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

```
```
