# Video Surveillance over IP

A full-featured, browser-based video surveillance system that captures webcam input using FFmpeg and streams it in real time using MPEG-DASH. The backend is built with Node.js and Express, which launches FFmpeg automatically to stream live DASH segments. The frontend includes a **self-built video player** using HTML5 and JavaScript (without relying on native browser controls), powered by [dash.js](https://github.com/Dash-Industry-Forum/dash.js) for MPEG-DASH playback.

This project is a course project. The full project description and requirements can be found in the [Video Surveillance over IP.pdf](./Video%20Surveillance%20over%20IP.pdf) file included in this repository.


---

## Features

- **Live Video Capture** via webcam and mic using FFmpeg (`avfoundation` on macOS)
- **MPEG-DASH Live Streaming** using FFmpeg’s low-latency profile with configurable segment durations (2s, 4s, 6s)
- **Adaptive Bitrate Streaming** with 3 quality levels (720p, 480p, 360p), automatic or manual switching
- **Self-hosted Express Server** that:
  - Launches FFmpeg dynamically
  - Hosts DASH streams and thumbnails
  - Responds to config updates (like segment duration)
- **Custom HTML5 Video Player** with:
  - Play / Pause toggle
  - Volume slider + mute toggle
  - Seek bar with hoverable thumbnail preview
  - “Go Live” button to jump to the live edge
  - Screenshot functionality (PNG / JPEG export)
  - Resolution & latency display
  - Dynamic layout toggle (medium/wide mode)
  - Settings panel for segment duration and thumbnail size
- **Clean Exit Handling**: All thumbnails and generated segments are auto-removed on shutdown

---

## Technologies Used

- [FFmpeg](https://ffmpeg.org/)
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [dash.js](https://github.com/Dash-Industry-Forum/dash.js)
- HTML5, CSS, JavaScript

---

## 🧠 How it Works (Behind the Scenes)

- **Stream Generation:** FFmpeg captures video and audio from the webcam and encodes it to H.264/AAC. The `-f dash` flag with `-ldash 1` enables the DASH live profile with low latency.
- **Multi-Representation Encoding:** Four different video resolutions (720p, 480p, 360p, 144p) are generated in parallel using FFmpeg’s split and scale filters, allowing dynamic bitrate switching on the client based on network conditions or user preference.
- **Player Initialization Wait Logic:** The frontend waits until the DASH manifest and at least 3 segments are available before initializing playback, ensuring a smooth viewer experience even if FFmpeg starts late.
- **Thumbnails:** On the server, FFmpeg periodically extracts a frame from the stream using `-ss <timestamp>` and `-frames:v 1`. These are served via `/thumbnails/` and dynamically rendered in the player on seek hover.
- **Segment Duration Switching:** The segment duration selector sends a POST request to restart FFmpeg with a new `-seg_duration`, allowing live control of stream granularity.
- **Live Latency Tracking:** The player calculates and displays current live latency every second using dash.js APIs.
- **Screenshot Feature:** The current video frame is drawn to a hidden `<canvas>` and exported as an image.
- **Segment & Thumbnail Cleanup:** On server exit (via SIGINT or SIGTERM), all generated DASH segments and thumbnails are cleaned up from the filesystem to avoid clutter and storage bloat.

---


## Try on your own

1. **Install Node.js** if not already installed.
2. Run the server:
   ```bash
   node server/server.js