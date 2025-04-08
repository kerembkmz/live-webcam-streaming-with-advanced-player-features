const url = '/stream/manifest.mpd';
const video = document.getElementById('videoPlayer');
const player = dashjs.MediaPlayer().create();
const screenshotBtn = document.getElementById('screenshotButton');
const settingsBtn = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const imageFormatSelector = document.getElementById('imageFormat');
const segmentDurationSelector = document.getElementById('segmentDuration');

let playerInitialized = false;

async function waitForManifestAndStartPlayer(playerInitialized) {
    const maxRetries = 20;
    const delay = 1000;
  
    for (let i = 0; i < maxRetries; i++) {
      try {
        const manifestRes = await fetch(url, { cache: "no-store" });
        const initRes = await fetch('/stream/init-stream0.m4s', { cache: "no-store" });
        const chunkRes = await fetch('/stream/chunk-stream0-00001.m4s', { cache: "no-store" });
  
        if (manifestRes.ok && initRes.ok && chunkRes.ok) {
          if (playerInitialized)
          {
            console.log("since player is initialzed, resetting the player.");
            player.reset();
          }
          console.log('manifest, init, and chunk are available. Initializing player...');
          const dashUrl = url + `?v=${Date.now()}`;
          player.updateSettings({
            streaming: {
              liveDelay: 2.0,
              lowLatencyEnabled: true
            }
          });
          player.initialize(video, dashUrl, true);
          return;
        }
      } catch (err) {
        console.warn(`Waiting for stream to be ready... Retry count: (${i + 1}/20)`);
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
    console.log('Playback started — measuring latency...');

    setInterval(() => {
      const latency = player.getCurrentLiveLatency();
      if (latency != null && !isNaN(latency)) {
        console.log(`Live Latency: ${latency.toFixed(2)} seconds`);
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