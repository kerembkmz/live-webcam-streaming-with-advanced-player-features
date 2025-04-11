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
    '-f', 'avfoundation',
    '-framerate', '30',
    '-video_size', '1280x720',
    '-i', '0:0',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-g', '30',
    '-keyint_min', '30',
    '-sc_threshold', '0',
    '-b:v', '3000k',
    '-maxrate', '3000k',
    '-bufsize', '3000k',
    '-vf',
      `drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf':\
text='%{localtime\\:%X}':\
x=(w-text_w)/2: y=h-(2*text_h):\
fontcolor=white: fontsize=24:\
box=1: boxcolor=black@0.5: boxborderw=5`,
    '-f', 'dash',
    '-seg_duration', `${segmentDuration}`,
    '-window_size', '0',
    '-extra_window_size', '0',
    '-use_template', '1',
    '-use_timeline', '1',
    '-streaming', '1',
    '-ldash', '1',
    '-remove_at_exit', '1',
    path.join(OUTPUT_DIR, 'manifest.mpd')
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
      console.log(`✅ Generated ${path.basename(thumbPath)}`);
      lastThumbIndex++; // Only advance if successful
    } else {
      console.warn(`⏳ Retry thumb-${String(index).padStart(3, '0')} later...`);
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
    console.log('🧹 Thumbnails cleaned up on exit.');
  }
}

process.on('SIGINT', () => {
  console.log('\n📦 Server shutting down (SIGINT)...');
  cleanThumbnails();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📦 Server shutting down (SIGTERM)...');
  cleanThumbnails();
  process.exit(0);
});