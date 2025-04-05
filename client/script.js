const url = '/stream/manifest.mpd';
const video = document.getElementById('videoPlayer');

const player = dashjs.MediaPlayer().create();
player.initialize(video, url, true);
