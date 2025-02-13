function playMusic() {
    const audio = document.getElementById('background-music');
    audio.volume = 0.5;
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            hidePopup();
        }).catch(error => {
            console.log("Playback failed:", error);
        });
    }
}

function hidePopup() {
    document.getElementById('music-popup').style.display = 'none';
}