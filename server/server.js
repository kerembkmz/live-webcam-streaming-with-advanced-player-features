const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const OUTPUT_DIR = path.join(__dirname, '..', 'stream_output');
const THUMBNAIL_DIR = path.join(__dirname, '..', 'thumbnails');

let ffmpegProcess = null;
let thumbnailInterval = null;
let currentSegmentDuration = 2;
let lastThumbIndex = 0;

async function startFFmpeg(segmentDuration = currentSegmentDuration) {
  currentSegmentDuration = segmentDuration;

  if (ffmpegProcess) {
    console.log('Stopping existing FFmpeg process...');
    lastThumbIndex = 0;
    ffmpegProcess.kill('SIGINT');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
  } else {
    fs.readdirSync(THUMBNAIL_DIR).forEach(file => {
      fs.unlinkSync(path.join(THUMBNAIL_DIR, file));
    });
  }

  const ffmpegArgs = [
    // Capture Settings (Mac Only, uses AVFoundation)
    '-f', 'avfoundation', 
    '-framerate', '30', //capture fps is set to 30
    '-video_size', '1280x720',  //capture resolution
    '-i', '0:0', // webcam + mic

    // Encoding settings for low-latency
    '-preset', 'ultrafast', //use the fastest encoding
    '-tune', 'zerolatency', //optimize for lowest latency
    '-g', '30', //GOP Size: 1 (since 30FPS)
    '-keyint_min', '30', //Minimum GOP Size
    '-sc_threshold', '0', //Disabling scene change detection for unwanted keyframes

    // Audio Encoding
    '-c:a', 'aac', //codec: AAC
    '-b:a', '128k', //bitrate: 128kbps
    '-ar', '48000', //sample rate: 48kHz
    '-ac', '1', //mono audio

    // video filter: adding timestamp overlay, splitting and scaling for ABR
    '-filter_complex',
    `[0:v]drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf':\
  text='%{localtime\\:%X}':x=(w-text_w)/2:y=h-(2*text_h):\
  fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5,split=4[v1][v2][v3][v4];\
  [v2]scale=854:480[v480];\
  [v3]scale=640:360[v360];\
  [v4]scale=256:144[v144]`,

    // Mapping the video representations
    '-map', '[v1]', '-c:v:0', 'libx264', '-b:v:0', '3000k', '-maxrate:v:0', '3000k', '-bufsize:v:0', '3000k',
    '-map', '[v480]', '-c:v:1', 'libx264', '-b:v:1', '1500k', '-maxrate:v:1', '1500k', '-bufsize:v:1', '1500k',
    '-map', '[v360]', '-c:v:2', 'libx264', '-b:v:2', '800k', '-maxrate:v:2', '800k', '-bufsize:v:2', '800k',
    '-map', '[v144]', '-c:v:3', 'libx264', '-b:v:3', '300k', '-maxrate:v:3', '300k', '-bufsize:v:3', '300k',

    // Map audio
    '-map', '0:a:0',

    // Dash output settings
    '-f', 'dash', //MPEG-DASH output
    '-seg_duration', `${segmentDuration}`, //Segment length in seconds (dynamically set)
    '-window_size', '0', //keeping all segments in the manifest (for full seek ability)
    '-extra_window_size', '0', //no extra buffer
    '-use_template', '1', //template for segment file naming
    '-use_timeline', '1', //use timeline entry in the manifest
    '-streaming', '1', //enable streaming
    '-ldash', '1', //low-latency DASH profile
    '-remove_at_exit', '1', //cleanup segments afterwards
    path.join(OUTPUT_DIR, 'manifest.mpd') //output manifest and segments to stream folder
  ];

  console.log(`Starting FFmpeg with segment duration = ${segmentDuration}s`);
  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stderr.on('data', data => console.error(`FFmpeg stderr: ${data}`));
  ffmpegProcess.on('close', code => {
    console.log(`FFmpeg exited with code ${code}`);
    ffmpegProcess = null;
  });

  setTimeout(() => {
    generateNextThumbnail();
  }, 6000);
}

function generateNextThumbnail() {
  const index = lastThumbIndex;
  const thumbPath = path.join(THUMBNAIL_DIR, `thumb-${String(index).padStart(3, '0')}.jpg`);

  const ffmpegThumbArgs = [
    '-y',
    '-copyts', '-start_at_zero',
    '-i', path.join(OUTPUT_DIR, 'manifest.mpd'),
    '-ss', `${index}`,
    '-frames:v', '1',
    '-vf', 'scale=320:-1',
    thumbPath
  ];

  const thumbProc = spawn('ffmpeg', ffmpegThumbArgs);
  let ffmpegError = false;

  thumbProc.stderr.on('data', data => {
    const msg = data.toString();
    console.error(`Thumbnail stderr: ${msg}`);
    if (msg.includes('Invalid data') || msg.includes('error reading header')) {
      ffmpegError = true;
    }
  });

  thumbProc.on('close', code => {
    if (code === 0 && !ffmpegError) {
      console.log(` Generated ${path.basename(thumbPath)}`);
      lastThumbIndex++; // Only advance if successful
    } else {
      console.warn(` Retry thumb-${String(index).padStart(3, '0')} later...`);
    }

    setTimeout(generateNextThumbnail, 200);
  });
}

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/stream', express.static(OUTPUT_DIR));
app.use('/thumbnails', express.static(THUMBNAIL_DIR));
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
  startFFmpeg(currentSegmentDuration);
});

app.post('/restart-ffmpeg', (req, res) => {
  const { segmentDuration } = req.body;
  if (!segmentDuration || isNaN(segmentDuration)) {
    return res.status(400).send('Invalid segment duration');
  }

  console.log(`Restarting FFmpeg with segmentDuration=${segmentDuration}s`);
  try {
    startFFmpeg(Number(segmentDuration));
    res.status(200).send('FFmpeg restarted');
  } catch (err) {
    console.error('Failed to restart FFmpeg:', err);
    res.status(500).send('Failed to restart FFmpeg');
  }
});

function cleanThumbnails() {
  if (fs.existsSync(THUMBNAIL_DIR)) {
    fs.readdirSync(THUMBNAIL_DIR).forEach(file => {
      fs.unlinkSync(path.join(THUMBNAIL_DIR, file));
    });
    console.log(' Thumbnails cleaned up on exit.');
  }
}

process.on('SIGINT', () => {
  console.log('\n Server shutting down (SIGINT)...');
  cleanThumbnails();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n Server shutting down (SIGTERM)...');
  cleanThumbnails();
  process.exit(0);
});