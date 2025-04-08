const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const OUTPUT_DIR = path.join(__dirname, '..', 'stream_output');

let ffmpegProcess = null;
let currentSegmentDuration = 2; 

function startFFmpeg(segmentDuration = currentSegmentDuration) {
  currentSegmentDuration = segmentDuration;

  if (ffmpegProcess) {
    console.log('Stopping existing FFmpeg process...');
    ffmpegProcess.kill('SIGINT');
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
    '-b:v', '3000k',
    '-minrate', '3000k',
    '-maxrate', '3000k',
    '-bufsize', '3000k',
    '-s', '1280x720',
    '-f', 'dash',
    '-seg_duration', `${segmentDuration}`,
    '-window_size', '2',
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

  ffmpegProcess.stdout.on('data', data => console.log(`FFmpeg stdout: ${data}`));
  ffmpegProcess.stderr.on('data', data => console.error(`FFmpeg stderr: ${data}`));
  ffmpegProcess.on('close', code => {
    console.log(`FFmpeg exited with code ${code}`);
    ffmpegProcess = null;
  });
}

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/stream', express.static(OUTPUT_DIR));
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
