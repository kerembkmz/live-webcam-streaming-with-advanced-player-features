const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const app = express();
const PORT = 3000;

const OUTPUT_DIR = path.join(__dirname, '..', 'stream_output');

function startFFmpeg() {
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
    '-seg_duration', '2',
    '-window_size', '2',
    '-extra_window_size', '1',
    '-use_template', '1',
    '-use_timeline', '1',
    '-streaming', '1',
    '-ldash', '1',
    '-remove_at_exit', '1',
    path.join(OUTPUT_DIR, 'manifest.mpd')
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stdout.on('data', data => console.log(`FFmpeg stdout: ${data}`));
  ffmpeg.stderr.on('data', data => console.error(`FFmpeg stderr: ${data}`));
  ffmpeg.on('close', code => console.log(`FFmpeg exited with code ${code}`));

  console.log('FFmpeg started...');
}

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/stream', express.static(OUTPUT_DIR));

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
  startFFmpeg(); 
});
