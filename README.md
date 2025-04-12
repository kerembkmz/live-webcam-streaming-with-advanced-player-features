# Video Surveillance over IP

A full-featured, browser-based video surveillance system that captures webcam input using FFmpeg and streams it in real time using MPEG-DASH. The backend is built with Node.js and Express, which launches FFmpeg automatically to stream live DASH segments. The frontend includes a **self-built video player** using HTML5 and JavaScript (without relying on native browser controls), powered by [dash.js](https://github.com/Dash-Industry-Forum/dash.js) for MPEG-DASH playback.

This project is a course project. The full project description and requirements can be found in the [Video Surveillance over IP.pdf](./Video%20Surveillance%20over%20IP.pdf) file included in this repository.


---

## Features

- Live webcam capture using FFmpeg (`avfoundation` input on macOS)
- **MPEG-DASH** stream configuration for near real-time playback (around 6 second delay)
- Supports Adaptive Bitrate Streaming (can be configured automatic or manually)
- Node.js + Express server that manages FFmpeg and serves DASH content
- Custom HTML5 player with:
  - Play/Pause controls and audio options
  - Seek bar (with thumbnail previews enabled)
  - **"Go Live"** button to jump to the live edge
  - Screenshot functionality (capturing the current frame)
  - Latency and buffer monitoring display
  - Support for different video and thumbnail sizes
- Properly segmented live streaming using `ffmpeg`’s DASH Live profile
- Clean auto-removal of all generated files (semgnet, thumbnail and etc.) after process exit

---

## Technologies Used

- [FFmpeg](https://ffmpeg.org/)
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [dash.js](https://github.com/Dash-Industry-Forum/dash.js)
- HTML5, CSS, JavaScript

---
