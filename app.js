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
    // Determina il contenitore corretto in base alla visibilità dello schermo (Android vs Desktop)
    const containerId = window.innerWidth < 768 ? 'mobilePlayerWrapper' : 'ytPlayerContainer';
    
    // Sposta il div se siamo su mobile per evitare bug di rendering dell'iframe nascosto
    if(window.innerWidth < 768) {
        document.getElementById('mobilePlayerWrapper').innerHTML = '<div id="ytPlayerMobile"></div>';
    }

    player = new YT.Player(window.innerWidth < 768 ? 'ytPlayerMobile' : 'ytPlayerContainer', {
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
    const vol = document.getElementById('volumeSlider') ? document.getElementById('volumeSlider').value : 100;
    player.setVolume(vol);
    startProgressLoop();
}

function onPlayerStateChange(event) {
    const playIcon = document.getElementById('playIcon');
    const mobilePlayIcon = document.getElementById('mobilePlayIcon');

    if (event.data == YT.PlayerState.PLAYING) {
        appState.isPlaying = true;
        if(playIcon) playIcon.className = "fa-solid fa-pause";
        if(mobilePlayIcon) mobilePlayIcon.className = "fa-solid fa-pause";
        
        const fallback = document.getElementById('coverFallback');
        if(fallback) fallback.style.display = "none";
        updateDuration();
    } else {
        appState.isPlaying = false;
        if(playIcon) playIcon.className = "fa-solid fa-play pl-0.5";
        if(mobilePlayIcon) mobilePlayIcon.className = "fa-solid fa-play";
        
        if (event.data == YT.PlayerState.ENDED) {
            nextTrack();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Rendi visibile il body solo a DOM carico per evitare sfarfallii su Android
    document.body.classList.remove('hidden');

    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const volumeSlider = document.getElementById('volumeSlider');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const apiConfigBtn = document.getElementById('apiConfigBtn');

    // Listener Ricerca
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    
    // Listener Controlli Desktop
    document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
    document.getElementById('prevBtn').addEventListener('click', prevTrack);
    document.getElementById('nextBtn').addEventListener('click', nextTrack);

    // Listener Controlli Mobile (Touch)
    document.getElementById('mobilePlayPauseBtn').addEventListener('click', togglePlay);
    document.getElementById('mobilePrevBtn').addEventListener('click', prevTrack);
    document.getElementById('mobileNextBtn').addEventListener('click', nextTrack);
    
    if(volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            if (player && player.setVolume) player.setVolume(e.target.value);
        });
    }

    progressBarContainer.addEventListener('click', seekVideo);
    apiConfigBtn.addEventListener('click', configureApiKey);

    if (!appState.apiKey) {
        setTimeout(() => { alert("Benvenuto su YouTubette! Tocca l'ingranaggio in alto a destra per salvare la tua YouTube API Key."); }, 800);
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

        if (data.error) throw new Error(data.error.message);

        appState.tracks = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.default.url
        }));

        renderTracklist();
    } catch (error) {
        alert("Errore: " + error.message);
        placeholderText.innerText = "Errore. Controlla la tua API Key.";
    }
}

function renderTracklist() {
    const trackListDiv = document.getElementById('trackList');
    trackListDiv.innerHTML = '';

    if (appState.tracks.length === 0) {
        trackListDiv.innerHTML = '<p class="text-gray-500 text-sm p-2 italic text-center">Nessun risultato.</p>';
        return;
    }

    appState.tracks.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = `flex items-center p-2 rounded active:bg-[#282828] md:hover:bg-[#282828] cursor-pointer transition-colors ${appState.currentIndex === index ? 'bg-[#1a1a1a]' : ''}`;
        trackRow.innerHTML = `
            <div class="w-6 text-gray-400 text-xs text-center">${index + 1}</div>
            <img src="${track.thumbnail}" class="w-9 h-9 object-cover rounded mx-2.5">
            <div class="flex-1 overflow-hidden">
                <p class="text-xs font-medium truncate ${appState.currentIndex === index ? 'text-[#1DB954]' : 'text-white'}">${track.title}</p>
                <p class="text-[10px] text-gray-400 truncate mt-0.5">${track.channel}</p>
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
    
    const mainTitle = document.getElementById('mainTrackTitle');
    if(mainTitle) mainTitle.innerText = track.title;
    const mainChannel = document.getElementById('mainTrackChannel');
    if(mainChannel) mainChannel.innerText = track.channel;

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
        if (appState.apiKey) alert("API Key salvata!");
    }
}
