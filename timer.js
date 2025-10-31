let timerInterval = null;
export let totalSeconds = 10;
let timerRunning = false;

const timerDisplay = document.querySelector('#game-timer');
if (!timerDisplay) {
    console.error("Elemento HTML '#game-timer' no encontrado.");
}

function formatTime(secs) {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
}

export function stopTimer() {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRunning = false;
        timerDisplay.textContent = `¡Tiempo Agotado!`; 
    }
}

export function startTimer() {
    if (timerRunning || totalSeconds <= 0 ) return;
    
    timerRunning = true;
    
    timerDisplay.style.display = 'block';
    timerDisplay.textContent = `${formatTime(totalSeconds)}`; 
    
    timerInterval = setInterval(() => {
        totalSeconds--;
        timerDisplay.textContent = `${formatTime(totalSeconds)}`;
        
        if (totalSeconds <= 0) {
            stopTimer();
        }
    }, 1000);
}

export function restartTimer(){
    clearInterval(timerInterval);
    timerInterval = null;
    totalSeconds = 10;
    timerRunning = false;
    timerDisplay.textContent = `¡Misión cumplida!`; 
}