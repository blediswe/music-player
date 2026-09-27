let audio = null;
let currentSongPath = null;
let currentQueue = [];
let currentQueueName = '';
let currentQueueIndex = -1;
let selectedPlaylistName = 'Favorites';
let focusedSongPath = null;
let libraryPage = 'home';
let isDragging = false;
let isVolumeDragging = false;
let isFavorite = false;
let progressPollId = null;
let hasPendingAutoAdvance = false;

const DOWNLOADS_PLAYLIST = 'Downloads';
const DEFAULT_PLAYLISTS = [DOWNLOADS_PLAYLIST, 'Favorites'];
const playlists = { [DOWNLOADS_PLAYLIST]: [], Favorites: [] };

// Elements
const playPauseBtn = document.getElementById('playPause');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');

const searchBar = document.getElementById('searchBar');
const searchResults = document.getElementById('searchResults');
const playlistList = document.getElementById('playlistList');
const playlistMessage = document.getElementById('playlistMessage');
const queueLabel = document.getElementById('queueLabel');
const libraryView = document.getElementById('libraryView');
const playlistPage = document.getElementById('playlistPage');
const backToLibraryBtn = document.getElementById('backToLibraryBtn');
const playlistModal = document.getElementById('playlistModal');
const playlistModalInput = document.getElementById('playlistModalInput');
const playlistModalCancel = document.getElementById('playlistModalCancel');
const playlistModalCreate = document.getElementById('playlistModalCreate');
const addToPlaylistModal = document.getElementById('addToPlaylistModal');
const addToPlaylistList = document.getElementById('addToPlaylistList');
const addToPlaylistCancel = document.getElementById('addToPlaylistCancel');
const playlistContentsName = document.getElementById('playlistContentsName');
const playlistContentsList = document.getElementById('playlistContentsList');

const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const albumEl = document.getElementById('album');
const albumArtEl = document.getElementById('albumArt');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

const progressContainer = document.getElementById('progressContainer');
const progress = document.getElementById('progress');
const handle = document.getElementById('handle');

const volumeContainer = document.getElementById('volumeContainer');
const volumeProgress = document.getElementById('volumeProgress');
const volumeHandle = document.getElementById('volumeHandle');

// Helpers
function formatTime(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

function getSongNameFromPath(path) {
  if (!path) return 'Unknown';
  const fileName = path.split(/[/\\]/).pop() || path;
  return fileName.replace(/\.[^.]+$/, '');
}

function toAudioSource(path) {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/');
  const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return encodeURI(`file://${prefixed}`);
}

function setSongDetails({ title, artist, album, albumArt }) {
  titleEl.textContent = title || 'No track selected';
  artistEl.textContent = `Artist: ${artist || 'Unknown'}`;
  albumEl.textContent = `Album: ${album || 'Unknown'}`;
  albumArtEl.src = albumArt || './image.png';
}

function setPlaylistMessage(message, isError = false) {
  playlistMessage.textContent = message;
  playlistMessage.style.color = isError ? '#ef8f8f' : '#9ad3a7';
}

function setQueue(queue, queueName, activeSongPath = null) {
  currentQueue = [...queue];
  currentQueueName = queueName || '';
  currentQueueIndex = activeSongPath ? currentQueue.indexOf(activeSongPath) : 0;

  if (currentQueueIndex < 0 && currentQueue.length > 0) {
    currentQueueIndex = 0;
  }

  queueLabel.textContent = currentQueue.length > 0
    ? `${currentQueueName} / ${currentQueueIndex + 1}/${currentQueue.length}`
    : 'No active queue';
}

function getQueueByName(queueName) {
  if (!queueName || !playlists[queueName]) {
    return currentQueue;
  }

  return playlists[queueName];
}

function updateQueueLabel() {
  queueLabel.textContent = currentQueue.length > 0
    ? `${currentQueueName} / ${currentQueueIndex + 1}/${currentQueue.length}`
    : 'No active queue';
}

function setProgressUI(percent) {
  const safePercent = Math.max(0, Math.min(100, percent || 0));
  progress.style.width = `${safePercent}%`;
  handle.style.left = `${safePercent}%`;
}

function setVolumeUI(volume) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  volumeProgress.style.width = `${safeVolume * 100}%`;
  volumeHandle.style.left = `${safeVolume * 100}%`;
}

function updateFavoriteButton() {
  favoriteBtn.innerHTML = isFavorite ? '&#9829;' : '&#9825;';
}

function syncProgressUI() {
  if (!audio) return;

  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isDragging) {
    setProgressUI(percent);
  }

  currentTimeEl.textContent = formatTime(currentTime);
  durationEl.textContent = formatTime(duration);

  if (
    !hasPendingAutoAdvance &&
    duration > 0 &&
    currentTime >= duration - 0.2 &&
    !audio.paused
  ) {
    hasPendingAutoAdvance = true;
    stopProgressPolling();
    window.setTimeout(() => {
      playNextTrack();
    }, 50);
  }
}

function stopProgressPolling() {
  if (progressPollId !== null) {
    window.clearInterval(progressPollId);
    progressPollId = null;
  }
}

function startProgressPolling() {
  stopProgressPolling();
  progressPollId = window.setInterval(() => {
    syncProgressUI();
  }, 200);
}

function openPlaylistPage(name) {
  if (!name || !playlists[name]) return;
  selectedPlaylistName = name;
  libraryPage = 'playlist';
}

function showLibraryHome() {
  libraryPage = 'home';
}

function updateLibraryView() {
  libraryView.classList.toggle('isHidden', libraryPage !== 'home');
  playlistPage.classList.toggle('isHidden', libraryPage !== 'playlist');
}

function openPlaylistModal() {
  playlistModal.classList.remove('isHidden');
  playlistModalInput.value = '';
  setTimeout(() => playlistModalInput.focus(), 0);
}

function closePlaylistModal() {
  playlistModal.classList.add('isHidden');
}

function openAddToPlaylistModal() {
  renderPlaylistOptions();
  addToPlaylistModal.classList.remove('isHidden');
  const firstButton = addToPlaylistList.querySelector('button');
  setTimeout(() => firstButton?.focus(), 0);
}

function closeAddToPlaylistModal() {
  addToPlaylistModal.classList.add('isHidden');
}

function renderPlaylistOptions() {
  addToPlaylistList.innerHTML = '';

  const customPlaylists = Object.keys(playlists)
    .filter((playlistName) => !DEFAULT_PLAYLISTS.includes(playlistName));

  if (customPlaylists.length === 0) {
    const emptyItem = document.createElement('li');
    const emptyText = document.createElement('p');
    emptyText.className = 'modalEmptyState';
    emptyText.textContent = 'No playlists yet.';
    emptyItem.appendChild(emptyText);
    addToPlaylistList.appendChild(emptyItem);
    return;
  }

  customPlaylists.forEach((playlistName) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghostButton modalPlaylistButton';
    button.textContent = playlistName;
    button.dataset.playlistName = playlistName;
    item.appendChild(button);
    addToPlaylistList.appendChild(item);
  });
}

function renderPlaylists() {
  playlistList.innerHTML = '';

  const orderedPlaylists = [
    ...DEFAULT_PLAYLISTS.filter((playlistName) => playlists[playlistName]),
    ...Object.keys(playlists).filter((playlistName) => !DEFAULT_PLAYLISTS.includes(playlistName))
  ];

  orderedPlaylists.forEach((playlistName) => {
    const playlistItem = document.createElement('li');
    const playlistHeader = document.createElement('div');
    const playlistMain = document.createElement('div');
    const playlistTitle = document.createElement('span');
    const playlistMeta = document.createElement('span');

    playlistItem.className = 'playlistItem';
    playlistHeader.className = 'playlistHeader';
    if (playlistName === selectedPlaylistName) {
      playlistHeader.classList.add('isSelected');
    }
    playlistMain.className = 'playlistHeaderMain';
    playlistMain.dataset.playlistName = playlistName;

    playlistTitle.className = 'playlistHeaderTitle';
    playlistTitle.textContent = playlistName;

    playlistMeta.className = 'playlistMeta';
    playlistMeta.textContent = `${playlists[playlistName].length} song${playlists[playlistName].length === 1 ? '' : 's'}`;

    playlistMain.appendChild(playlistTitle);
    playlistMain.appendChild(playlistMeta);
    playlistHeader.appendChild(playlistMain);

    if (playlistName === DOWNLOADS_PLAYLIST) {
      const importButton = document.createElement('button');
      importButton.className = 'ghostButton dangerButton';
      importButton.innerHTML = '<span class="iconGlyph">&#8681;</span>';
      importButton.title = 'Import songs';
      importButton.dataset.importSongs = 'true';
      playlistHeader.appendChild(importButton);
    }

    if (!DEFAULT_PLAYLISTS.includes(playlistName)) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'ghostButton dangerButton';
      deleteButton.innerHTML = '<span class="iconGlyph">&#8722;</span>';
      deleteButton.title = 'Delete playlist';
      deleteButton.dataset.deletePlaylist = playlistName;
      playlistHeader.appendChild(deleteButton);
    }

    playlistItem.appendChild(playlistHeader);
    playlistList.appendChild(playlistItem);
  });

  renderPlaylistOptions();
}

function renderSelectedPlaylistContents() {
  playlistContentsList.innerHTML = '';

  if (!selectedPlaylistName || !playlists[selectedPlaylistName]) {
    playlistContentsName.textContent = 'Select a playlist';
    return;
  }

  playlistContentsName.textContent = selectedPlaylistName;

  if (playlists[selectedPlaylistName].length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'contentSongItem';
    emptyItem.textContent = 'No songs in this playlist yet';
    playlistContentsList.appendChild(emptyItem);
    return;
  }

  playlists[selectedPlaylistName].forEach((songPath) => {
    const songItem = document.createElement('li');
    songItem.className = 'contentSongItem';
    if (songPath === focusedSongPath) {
      songItem.classList.add('isFocused');
    }
    songItem.textContent = getSongNameFromPath(songPath);
    songItem.dataset.songPath = songPath;
    songItem.dataset.playlistName = selectedPlaylistName;
    playlistContentsList.appendChild(songItem);
  });
}

function renderSearchResults() {
  const query = searchBar.value.toLowerCase().trim();
  searchResults.innerHTML = '';

  if (!query) return;

  let hasResults = false;

  Object.keys(playlists).forEach((playlistName) => {
    if (playlistName.toLowerCase().includes(query)) {
      const item = document.createElement('li');
      item.className = 'searchItem';
      item.textContent = `${playlistName} / Playlist`;
      item.dataset.playlistName = playlistName;
      searchResults.appendChild(item);
      hasResults = true;
    }

    playlists[playlistName].forEach((songPath) => {
      const songName = getSongNameFromPath(songPath);
      if (songName.toLowerCase().includes(query)) {
        const item = document.createElement('li');
        item.className = 'searchItem';
        item.textContent = `${songName} / ${playlistName}`;
        item.dataset.songPath = songPath;
        item.dataset.playlistName = playlistName;
        searchResults.appendChild(item);
        hasResults = true;
      }
    });
  });

  if (!hasResults) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'searchEmptyState';
    emptyItem.textContent = `"${searchBar.value.trim()}" doesn't exist.`;
    searchResults.appendChild(emptyItem);
  }
}

function renderLibrary() {
  updateLibraryView();
  renderPlaylists();
  renderSelectedPlaylistContents();
  renderSearchResults();

  if (libraryPage === 'playlist' && focusedSongPath) {
    const focusedSong = playlistContentsList.querySelector(`[data-song-path="${CSS.escape(focusedSongPath)}"]`);
    if (focusedSong) {
      focusedSong.scrollIntoView({ block: 'nearest' });
    }
  }
}

function stopPlayback() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopProgressPolling();
  hasPendingAutoAdvance = false;

  playPauseBtn.innerHTML = '&#9654;';
  currentSongPath = null;
  currentQueue = [];
  currentQueueName = '';
  currentQueueIndex = -1;
  currentTimeEl.textContent = '0:00';
  durationEl.textContent = '0:00';
  setProgressUI(0);
  updateQueueLabel();
  isFavorite = false;
  updateFavoriteButton();
  setSongDetails({
    title: 'No track selected',
    artist: 'Unknown',
    album: 'Unknown',
    albumArt: './image.png'
  });
}

function loadAndPlay(path, queue = null, queueName = '', queueIndex = null) {
  if (!path) return;

  hasPendingAutoAdvance = false;
  currentSongPath = path;
  isFavorite = playlists.Favorites.includes(currentSongPath);
  updateFavoriteButton();

  if (queue) {
    setQueue(queue, queueName, path);
  } else if (queueIndex !== null && currentQueue.length > 0) {
    currentQueueIndex = queueIndex;
    updateQueueLabel();
  }

  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  audio = new Audio(toAudioSource(currentSongPath));
  audio.volume = volumeProgress.style.width ? parseFloat(volumeProgress.style.width) / 100 : 1;
  audio.play().catch(() => {
    setPlaylistMessage('Could not play that file.', true);
  });
  startProgressPolling();
  playPauseBtn.innerHTML = '&#10074;&#10074;';
  currentTimeEl.textContent = '0:00';
  durationEl.textContent = '0:00';
  setProgressUI(0);

  setSongDetails({
    title: getSongNameFromPath(currentSongPath),
    artist: 'Unknown',
    album: 'Unknown',
    albumArt: './image.png'
  });

  jsmediatags.read(currentSongPath, {
    onSuccess: (tag) => {
      const songTags = tag.tags || {};
      let albumArt = './image.png';

      if (songTags.picture) {
        let base64String = '';
        const bytes = songTags.picture.data;
        for (let i = 0; i < bytes.length; i += 1) {
          base64String += String.fromCharCode(bytes[i]);
        }
        albumArt = `data:${songTags.picture.format};base64,${btoa(base64String)}`;
      }

      setSongDetails({
        title: songTags.title || getSongNameFromPath(currentSongPath),
        artist: songTags.artist || 'Unknown',
        album: songTags.album || 'Unknown',
        albumArt
      });
    },
    onError: () => {
      setSongDetails({
        title: getSongNameFromPath(currentSongPath),
        artist: 'Unknown',
        album: 'Unknown',
        albumArt: './image.png'
      });
    }
  });

  audio.addEventListener('loadeddata', syncProgressUI);
  audio.onloadedmetadata = () => {
    syncProgressUI();
  };

  audio.ontimeupdate = () => {
    syncProgressUI();
  };

  audio.onplay = () => {
    hasPendingAutoAdvance = false;
    startProgressPolling();
  };

  audio.onpause = () => {
    syncProgressUI();
    stopProgressPolling();
  };

  audio.onseeked = () => {
    syncProgressUI();
  };

  audio.onended = () => {
    if (hasPendingAutoAdvance) return;
    hasPendingAutoAdvance = true;
    stopProgressPolling();
    playNextTrack();
  };
}

function playSongAtQueueIndex(index) {
  const queueToPlay = getQueueByName(currentQueueName);
  if (index < 0 || index >= queueToPlay.length) return;

  currentQueue = [...queueToPlay];
  currentQueueIndex = index;
  updateQueueLabel();
  loadAndPlay(queueToPlay[index], null, currentQueueName, index);
}

function playPreviousTrack() {
  const queueToPlay = getQueueByName(currentQueueName);
  if (queueToPlay.length === 0) return;

  const previousIndex = currentQueueIndex > 0 ? currentQueueIndex - 1 : 0;
  playSongAtQueueIndex(previousIndex);
}

function playNextTrack() {
  const queueToPlay = getQueueByName(currentQueueName);
  if (queueToPlay.length === 0) {
    playPauseBtn.innerHTML = '&#9654;';
    return;
  }

  const nextIndex = currentQueueIndex + 1;
  if (nextIndex >= queueToPlay.length) {
    playPauseBtn.innerHTML = '&#9654;';
    stopProgressPolling();
    currentQueue = [...queueToPlay];
    currentQueueIndex = queueToPlay.length - 1;
    updateQueueLabel();
    return;
  }

  playSongAtQueueIndex(nextIndex);
}

function addSongsToDownloads(filePaths) {
  const downloads = playlists[DOWNLOADS_PLAYLIST];
  filePaths.forEach((path) => {
    if (!downloads.includes(path)) {
      downloads.push(path);
    }
  });
  renderLibrary();
}

function addCurrentSongToPlaylist(name) {
  if (!currentSongPath) {
    setPlaylistMessage('Select a song first.', true);
    return false;
  }

  if (!name) {
    setPlaylistMessage('Choose a playlist first.', true);
    return false;
  }

  if (!playlists[name]) {
    setPlaylistMessage('That playlist no longer exists.', true);
    return false;
  }

  if (!playlists[name].includes(currentSongPath)) {
    playlists[name].push(currentSongPath);
    renderLibrary();
    setPlaylistMessage(`Added to ${name}.`);
    return true;
  }

  setPlaylistMessage(`This song is already in ${name}.`);
  return false;
}

function createPlaylist() {
  const name = playlistModalInput.value.trim();

  if (!name) {
    playlistModalInput.focus();
    setPlaylistMessage('Type a playlist name, then press Create.', true);
    return;
  }

  if (playlists[name]) {
    setPlaylistMessage('That playlist already exists.', true);
    return;
  }

  playlists[name] = [];
  openPlaylistPage(name);
  closePlaylistModal();
  renderLibrary();
  setPlaylistMessage(`Created playlist "${name}".`);
}

function deletePlaylist(name) {
  if (!name || !playlists[name] || DEFAULT_PLAYLISTS.includes(name)) return;

  delete playlists[name];

  if (currentQueueName === name) {
    stopPlayback();
  }

  if (selectedPlaylistName === name) {
    selectedPlaylistName = Object.keys(playlists)[0] || 'Favorites';
    showLibraryHome();
  }

  renderLibrary();
  setPlaylistMessage(`Deleted playlist "${name}".`);
}

async function importLocalSongs() {
  const filePaths = await window.electronAPI.selectMusic();
  if (!filePaths || filePaths.length === 0) return;

  addSongsToDownloads(filePaths);
  setQueue(playlists[DOWNLOADS_PLAYLIST], DOWNLOADS_PLAYLIST, filePaths[0]);
  loadAndPlay(filePaths[0], playlists[DOWNLOADS_PLAYLIST], DOWNLOADS_PLAYLIST);
  setPlaylistMessage(`Added ${filePaths.length} song${filePaths.length === 1 ? '' : 's'} to ${DOWNLOADS_PLAYLIST}.`);
}

// Events
playPauseBtn.onclick = () => {
  if (!audio) {
    if (playlists[DOWNLOADS_PLAYLIST].length > 0) {
      setQueue(playlists[DOWNLOADS_PLAYLIST], DOWNLOADS_PLAYLIST, playlists[DOWNLOADS_PLAYLIST][0]);
      loadAndPlay(playlists[DOWNLOADS_PLAYLIST][0], playlists[DOWNLOADS_PLAYLIST], DOWNLOADS_PLAYLIST);
    }
    return;
  }

  if (audio.paused) {
    audio.play();
    startProgressPolling();
    playPauseBtn.innerHTML = '&#10074;&#10074;';
  } else {
    audio.pause();
    playPauseBtn.innerHTML = '&#9654;';
  }
};

prevBtn.onclick = playPreviousTrack;
nextBtn.onclick = playNextTrack;
clearQueueBtn.onclick = stopPlayback;

favoriteBtn.onclick = () => {
  if (!currentSongPath) return;

  isFavorite = !isFavorite;

  if (isFavorite) {
    if (!playlists.Favorites.includes(currentSongPath)) {
      playlists.Favorites.push(currentSongPath);
    }
    setPlaylistMessage('Added to Favorites.');
  } else {
    playlists.Favorites = playlists.Favorites.filter((songPath) => songPath !== currentSongPath);
    setPlaylistMessage('Removed from Favorites.');
  }

  updateFavoriteButton();
  renderLibrary();
};

addToPlaylistBtn.onclick = () => {
  if (!currentSongPath) {
    setPlaylistMessage('Select a song first.', true);
    return;
  }

  if (Object.keys(playlists).filter((playlistName) => !DEFAULT_PLAYLISTS.includes(playlistName)).length === 0) {
    setPlaylistMessage('Create a playlist first.', true);
    return;
  }

  openAddToPlaylistModal();
};

newPlaylistBtn.onclick = openPlaylistModal;
playlistModalCreate.onclick = createPlaylist;
playlistModalCancel.onclick = closePlaylistModal;
playlistModal.addEventListener('click', (e) => {
  if (e.target === playlistModal) {
    closePlaylistModal();
  }
});
playlistModalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    createPlaylist();
  }
  if (e.key === 'Escape') {
    closePlaylistModal();
  }
});
addToPlaylistCancel.onclick = closeAddToPlaylistModal;
addToPlaylistModal.addEventListener('click', (e) => {
  if (e.target === addToPlaylistModal) {
    closeAddToPlaylistModal();
  }
});
addToPlaylistList.addEventListener('click', (e) => {
  const button = e.target.closest('[data-playlist-name]');
  if (!button) return;

  if (addCurrentSongToPlaylist(button.dataset.playlistName)) {
    closeAddToPlaylistModal();
  }
});
addToPlaylistModal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAddToPlaylistModal();
  }
});

playlistList.addEventListener('click', (e) => {
  const importSongsButton = e.target.closest('[data-import-songs]');
  if (importSongsButton) {
    importLocalSongs();
    return;
  }

  const deleteName = e.target.dataset.deletePlaylist;
  if (deleteName) {
    deletePlaylist(deleteName);
    return;
  }

  const playlistHeader = e.target.closest('[data-playlist-name]');
  if (!playlistHeader) return;

  const playlistName = playlistHeader.dataset.playlistName;
  focusedSongPath = null;
  openPlaylistPage(playlistName);
  renderLibrary();
  setPlaylistMessage(`Showing "${playlistName}".`);
});

searchBar.addEventListener('input', renderSearchResults);

searchResults.addEventListener('click', (e) => {
  const searchItem = e.target.closest('li');
  if (!searchItem) return;

  const songPath = searchItem.dataset.songPath;
  const playlistName = searchItem.dataset.playlistName;

  if (songPath && playlistName) {
    focusedSongPath = songPath;
    openPlaylistPage(playlistName);
    renderLibrary();
    setPlaylistMessage(`Opened "${playlistName}" for ${getSongNameFromPath(songPath)}.`);
    return;
  }

  if (playlistName && playlists[playlistName]) {
    focusedSongPath = null;
    openPlaylistPage(playlistName);
    renderLibrary();
    setPlaylistMessage(`Showing "${playlistName}".`);
  }
});

playlistContentsList.addEventListener('click', (e) => {
  const songItem = e.target.closest('[data-song-path]');
  if (!songItem) return;

  const songPath = songItem.dataset.songPath;
  const playlistName = songItem.dataset.playlistName;
  focusedSongPath = songPath;
  setQueue(playlists[playlistName] || [], playlistName, songPath);
  loadAndPlay(songPath, playlists[playlistName] || [], playlistName);
});

backToLibraryBtn.addEventListener('click', () => {
  focusedSongPath = null;
  showLibraryHome();
  renderLibrary();
});

handle.addEventListener('mousedown', (e) => {
  isDragging = true;
  e.preventDefault();
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  isVolumeDragging = false;
});

document.addEventListener('mousemove', (e) => {
  if (isDragging && audio) {
    const rect = progressContainer.getBoundingClientRect();
    let offsetX = e.clientX - rect.left;
    offsetX = Math.max(0, Math.min(rect.width, offsetX));
    audio.currentTime = (offsetX / rect.width) * audio.duration;
    setProgressUI((offsetX / rect.width) * 100);
  }

  if (isVolumeDragging) {
    const rect = volumeContainer.getBoundingClientRect();
    let offsetX = e.clientX - rect.left;
    offsetX = Math.max(0, Math.min(rect.width, offsetX));
    const volume = offsetX / rect.width;
    if (audio) {
      audio.volume = volume;
    }
    setVolumeUI(volume);
  }
});

progressContainer.onclick = (e) => {
  if (!audio) return;
  const rect = progressContainer.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  audio.currentTime = (offsetX / rect.width) * audio.duration;
  setProgressUI((offsetX / rect.width) * 100);
};

volumeHandle.addEventListener('mousedown', (e) => {
  isVolumeDragging = true;
  e.preventDefault();
});

volumeContainer.addEventListener('click', (e) => {
  const rect = volumeContainer.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const volume = offsetX / rect.width;
  if (audio) {
    audio.volume = volume;
  }
  setVolumeUI(volume);
});

// Initial render
setSongDetails({
  title: 'No track selected',
  artist: 'Unknown',
  album: 'Unknown',
  albumArt: './image.png'
});
setPlaylistMessage('');
setVolumeUI(1);
updateFavoriteButton();
updateQueueLabel();
renderLibrary();
