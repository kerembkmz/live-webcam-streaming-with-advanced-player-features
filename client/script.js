const url = '/stream/manifest.mpd';
const video = document.getElementById('videoPlayer');
const player = dashjs.MediaPlayer().create();
const screenshotBtn = document.getElementById('screenshotButton');
const settingsBtn = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const imageFormatSelector = document.getElementById('imageFormat');
const segmentDurationSelector = document.getElementById('segmentDuration');

const liveSlider = document.getElementById('liveSlider');
const goLiveBtn = document.getElementById('goLiveBtn');
const timeDisplay = document.getElementById('seekTimeDisplay');

let playerInitialized = false;
let isAtLiveEdge = true;
goLiveBtn.classList.add('live');
const thumbnailPreview = document.getElementById('thumbnailPreview');
const thumbnailImage = document.getElementById('thumbnailImage');

const thumbnailSizeSelector = document.getElementById('thumbnailSize');


const volumeSlider = document.getElementById('volumeSlider');
const volumeIcon = document.getElementById('volumeIcon');
const volumeToggleBtn = document.getElementById('volumeToggleBtn');


player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
  const resolutionSelector = document.getElementById('videoQuality');

  resolutionSelector.addEventListener('change', () => {
    const selected = resolutionSelector.value;

    if (selected === 'auto') {
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: true
            }
          }
        }
      });
    } else {
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: false
            }
          }
        }
      });

      const tracks = player.getTracksFor('video');
      const track = tracks[parseInt(selected)];
      if (track) {
        player.setCurrentTrack(track);
      } else {
        console.warn("Selected track not found.");
      }
    }
  });
});


volumeToggleBtn.addEventListener('click', () => {
  if (video.muted || video.volume === 0) {
    video.muted = false;
    video.volume = 1.0;
    volumeSlider.value = 100;
    volumeIcon.src = 'icons/audio.png';
  } else {
    video.muted = true;
    volumeIcon.src = 'icons/no_audio.png';
  }
});

volumeSlider.addEventListener('input', () => {
  const value = volumeSlider.value;
  video.volume = value / 100;

  if (video.muted && value > 0) {
    video.muted = false;
    volumeIcon.src = 'icons/audio.png';
  }

  if (value === '0') {
    video.muted = true;
    volumeIcon.src = 'icons/no_audio.png';
  }
});

const presentationToggleBtn = document.getElementById('presentationToggleBtn');
const videoContainer = document.getElementById('videoContainer');

presentationToggleBtn.addEventListener('click', () => {
  if (videoContainer.classList.contains('wide')) {
    videoContainer.classList.remove('wide');
    videoContainer.classList.add('medium');
  } else {
    videoContainer.classList.remove('medium');
    videoContainer.classList.add('wide');
  }
});

thumbnailSizeSelector.addEventListener('change', () => {
  const selected = thumbnailSizeSelector.value;
  thumbnailImage.classList.remove('small', 'medium', 'large', 'veryLarge');
  thumbnailImage.classList.add(selected);
});

liveSlider.addEventListener('mousemove', (e) => {
  const rect = liveSlider.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const rangeStart = player.timeShiftBufferRange?.start || 0;
  const rangeEnd = player.duration();
  const dvrWindow = rangeEnd - rangeStart;
  const targetTime = rangeStart + (dvrWindow * percent);

  const index = Math.floor(targetTime); 
  const paddedIndex = index.toString().padStart(3, '0'); 
  const thumbnailPath = `/thumbnails/thumb-${paddedIndex}.jpg`;

  thumbnailImage.src = thumbnailPath;
  thumbnailPreview.style.display = 'block';
  thumbnailPreview.style.left = `${e.clientX}px`;
  thumbnailPreview.style.top = `${rect.top}px`;
});


liveSlider.addEventListener('mouseleave', () => {
  thumbnailPreview.style.display = 'none';
});

const playPauseBtn = document.getElementById('playPauseBtn');


async function waitForManifestAndStartPlayer(playerInitialized) {
  const maxRetries = 30;
  const delay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const manifestRes = await fetch(url, { cache: "no-store" });
      const initRes = await fetch('/stream/init-stream0.m4s', { cache: "no-store" });
      const chunk1 = await fetch('/stream/chunk-stream0-00001.m4s', { cache: "no-store" });
      const chunk2 = await fetch('/stream/chunk-stream0-00002.m4s', { cache: "no-store" });
      const chunk3 = await fetch('/stream/chunk-stream0-00003.m4s', { cache: "no-store" });

      if (manifestRes.ok && initRes.ok && chunk1.ok && chunk2.ok && chunk3.ok) {
        if (playerInitialized) {
          console.log("Since player is initialized, resetting the player.");
          player.reset();
        }

        console.log('Manifest and 3 chunks are available. Initializing player...');
        const dashUrl = url + `?v=${Date.now()}`;

        player.updateSettings({
          streaming: {
            delay: {
              liveDelay: 7.0
            }
          }
        });

        player.initialize(video, dashUrl, true);
        return;
      }
    } catch (err) {
      console.warn(`Waiting for stream to be ready... Retry count: (${i + 1}/${maxRetries})`);
      console.error(err);
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  alert('Failed to load video stream. Please try again later.');
}
  
  waitForManifestAndStartPlayer(playerInitialized);
  playerInitialized = true;

settingsBtn.addEventListener('click', () => {
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
});

screenshotBtn.addEventListener('click', () => {
  const selectedFormat = imageFormatSelector.value || 'png';
  const canvas = document.getElementById('screenshotCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const mimeType = selectedFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `screenshot.${selectedFormat}`;
  link.click();
});

player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, function () {
    console.log('Playback started — latency will be measured now');

    setInterval(() => {
      const latency = player.getCurrentLiveLatency();
      if (latency != null && !isNaN(latency)) {
        document.getElementById('latencyDisplay').textContent =
          `Latency: ${latency.toFixed(2)}s`;
      }
    }, 1000);
  });

segmentDurationSelector.addEventListener('change', async (e) => {
    const seg_duration = e.target.value;
    console.log("Segment size has changed", seg_duration);

    const response = await fetch('/restart-ffmpeg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmentDuration: seg_duration })
    });
  
    if (response.ok) {
      console.log(`FFmpeg restarted with segment duration: ${seg_duration}s`);
      waitForManifestAndStartPlayer(playerInitialized);
    } else {
      alert('Failed to restart FFmpeg.');
    }
  });


function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

setInterval(() => {
  if (!player.isDynamic()) return;

  const rangeStart = player.timeShiftBufferRange?.start || 0;
  const currentTime = player.time();
  const rangeEnd = isAtLiveEdge ? currentTime : player.duration();
  

  if (isNaN(currentTime) || isNaN(rangeStart) || isNaN(rangeEnd)) return;

  const dvrWindow = rangeEnd - rangeStart;
  const percent = ((currentTime - rangeStart) / dvrWindow) * 100;

  liveSlider.value = Math.min(100, Math.max(0, percent));  
}, 1000);

liveSlider.addEventListener('input', () => {
  goLiveBtn.textContent = 'Go Live';
  goLiveBtn.classList.remove('live');
  isAtLiveEdge = false;
  const rangeStart = player.timeShiftBufferRange?.start || 0;
  const rangeEnd = player.duration();
  const dvrWindow = rangeEnd - rangeStart;
  const targetTime = rangeStart + (dvrWindow * (liveSlider.value / 100));
  player.seek(targetTime);
});

goLiveBtn.addEventListener('click', () => {
  isAtLiveEdge = true;
  player.seek(player.duration());
  goLiveBtn.textContent = 'LIVE';
  goLiveBtn.classList.add('live');
});



playPauseBtn.addEventListener('click', () => {
  if (video.paused) {
    video.play();
    playPauseBtn.textContent = '⏸';
  } else {
    goLiveBtn.textContent = 'Go Live';
    goLiveBtn.classList.remove('live');
    video.pause();
    playPauseBtn.textContent = '▶';
  }
});


setInterval(() => {
  const currentTrack = player.getCurrentTrackFor('video');
  console.log(currentTrack);

  if (currentTrack && currentTrack.bitrateList?.length > 0) {
    const res = currentTrack.bitrateList[0].height || 'unknown';
    document.getElementById('resolutionDisplay').textContent = `Current Resolution: ${res}p`;
  } else {
    document.getElementById('resolutionDisplay').textContent = 'Current Resolution: unknown';
  }
}, 1000);