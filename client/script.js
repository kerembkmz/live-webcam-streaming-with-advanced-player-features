const url = '/stream/manifest.mpd';
const video = document.getElementById('videoPlayer');
const player = dashjs.MediaPlayer().create();
const screenshotBtn = document.getElementById('screenshotButton');
const settingsBtn = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const imageFormatSelector = document.getElementById('imageFormat');

player.initialize(video, url, true);

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
