let appState = {
    apiKey: localStorage.getItem('youtubette_api_key') || '',
    tracks: [],
    currentIndex: -1,
    isPlaying: false
};

// Carica asincronicamente l'API Player di YouTube
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player('ytPlayerContainer', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'modestbranding': 1,
            'rel': 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    player.setVolume(document.getElementById('volumeSlider').value);
    startProgressLoop();
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        appState.isPlaying = true;
        document.getElementById('playIcon').className = "fa-solid fa-pause";
        document.getElementById('coverFallback').style.display = "none";
        updateDuration();
    } else {
        appState.isPlaying = false;
        document.getElementById('playIcon').className = "fa-solid fa-play pl-0.5";
        if (event.data == YT.PlayerState.ENDED) {
            nextTrack();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const apiConfigBtn = document.getElementById('apiConfigBtn');

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    
    playPauseBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);
    
    volumeSlider.addEventListener('input', (e) => {
        if (player && player.setVolume) player.setVolume(e.target.value);
    });

    progressBarContainer.addEventListener('click', seekVideo);
    apiConfigBtn.addEventListener('click', configureApiKey);

    if (!appState.apiKey) {
        setTimeout(() => { alert("Benvenuto su YouTubette! Per iniziare a cercare, configura la tua YouTube API Key cliccando sull'icona dell'ingranaggio in alto a destra."); }, 1000);
    }
});

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    if (!appState.apiKey) {
        configureApiKey();
        return;
    }

    const placeholderText = document.getElementById('placeholderText');
    placeholderText.innerText = "Ricerca in corso...";

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${appState.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        appState.tracks = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.default.url
        }));

        renderTracklist();
    } catch (error) {
        alert("Errore durante la ricerca: " + error.message);
        placeholderText.innerText = "Si è verificato un errore. Verifica la tua API Key.";
    }
}

function renderTracklist() {
    const trackListDiv = document.getElementById('trackList');
    trackListDiv.innerHTML = '';

    if (appState.tracks.length === 0) {
        trackListDiv.innerHTML = '<p class="text-gray-500 text-sm p-2 italic text-center">Nessun risultato trovato.</p>';
        return;
    }

    appState.tracks.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = `flex items-center p-2 rounded hover:bg-[#282828] cursor-pointer transition-colors group ${appState.currentIndex === index ? 'bg-[#1a1a1a]' : ''}`;
        trackRow.innerHTML = `
            <div class="w-8 text-gray-400 text-sm text-center group-hover:hidden">${index + 1}</div>
            <div class="w-8 text-[#1DB954] text-sm text-center hidden group-hover:block"><i class="fa-solid fa-play"></i></div>
            <img src="${track.thumbnail}" class="w-10 h-10 object-cover rounded mx-3">
            <div class="flex-1 overflow-hidden">
                <p class="text-sm font-medium truncate ${appState.currentIndex === index ? 'text-[#1DB954]' : 'text-white'}">${track.title}</p>
                <p class="text-xs text-gray-400 truncate mt-0.5">${track.channel}</p>
            </div>
        `;
        trackRow.addEventListener('click', () => loadTrack(index));
        trackListDiv.appendChild(trackRow);
    });
}

function loadTrack(index) {
    if (index < 0 || index >= appState.tracks.length) return;
    appState.currentIndex = index;
    const track = appState.tracks[index];

    document.getElementById('playerTrackTitle').innerText = track.title;
    document.getElementById('playerTrackChannel').innerText = track.channel;
    document.getElementById('mainTrackTitle').innerText = track.title;
    document.getElementById('mainTrackChannel').innerText = track.channel;
    document.getElementById('miniCover').innerHTML = `<img src="${track.thumbnail}" class="w-full h-full object-cover rounded">`;
    
    renderTracklist();

    if (player && player.loadVideoById) {
        player.loadVideoById(track.id);
    }
}

function togglePlay() {
    if (!player || appState.currentIndex === -1) return;
    if (appState.isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function nextTrack() {
    if (appState.tracks.length === 0) return;
    let nextIdx = appState.currentIndex + 1;
    if (nextIdx >= appState.tracks.length) nextIdx = 0;
    loadTrack(nextIdx);
}

function prevTrack() {
    if (appState.tracks.length === 0) return;
    let prevIdx = appState.currentIndex - 1;
    if (prevIdx < 0) prevIdx = appState.tracks.length - 1;
    loadTrack(prevIdx);
}

function startProgressLoop() {
    setInterval(() => {
        if (player && player.getCurrentTime && appState.isPlaying) {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            if (duration > 0) {
                const pct = (currentTime / duration) * 100;
                document.getElementById('progressBar').style.width = `${pct}%`;
                document.getElementById('currentTime').innerText = formatTime(currentTime);
            }
        }
    }, 500);
}

function updateDuration() {
    if (player && player.getDuration) {
        const duration = player.getDuration();
        document.getElementById('durationTime').innerText = formatTime(duration);
    }
}

function seekVideo(e) {
    if (!player || appState.currentIndex === -1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const pct = clickX / width;
    const duration = player.getDuration();
    if (duration > 0) {
        player.seekTo(duration * pct, true);
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function configureApiKey() {
    const key = prompt("Inserisci la tua YouTube Data API v3 Key:", appState.apiKey);
    if (key !== null) {
        appState.apiKey = key.trim();
        localStorage.setItem('youtubette_api_key', appState.apiKey);
        if (appState.apiKey) alert("API Key salvata con successo!");
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker Registrato', reg))
            .catch(err => console.log('Errore Service Worker', err));
    });
}
