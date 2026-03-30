// DOM Elements
const timeDisplay = document.getElementById('timeDisplay');
const startPauseBtn = document.getElementById('startPauseBtn');
const skipBtn = document.getElementById('skipBtn');
const modeBtns = document.querySelectorAll('.mode-btn');
const progressCircle = document.querySelector('.progress-ring__circle');

// Modals
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const metricsBtn = document.getElementById('metricsBtn');
const metricsModal = document.getElementById('metricsModal');
const closeBtns = document.querySelectorAll('.close-modal');
const pipBtn = document.getElementById('pipBtn');
const pipContent = document.getElementById('pipContent');

// Settings Inputs
const focusInput = document.getElementById('focusInput');
const shortInput = document.getElementById('shortInput');
const longInput = document.getElementById('longInput');
const soundToggle = document.getElementById('soundToggle');
const themeOptions = document.querySelectorAll('.theme-option');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Metrics Elements
const statFocusTime = document.getElementById('statFocusTime');
const statSessions = document.getElementById('statSessions');
const sessionsList = document.getElementById('sessionsList');
const exportCsvBtn = document.getElementById('exportCsvBtn');

// State Variables
let timerState = {
    mode: 'focus', // focus | shortBreak | longBreak
    timeLeft: 25 * 60,
    isRunning: false,
    interval: null,
    totalTime: 25 * 60
};

let settings = {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    sound: true,
    theme: 'matcha-green'
};

let sessions = [];

// Audio Context (Initialize on first user interaction)
let audioCtx;
function playSoftChime() {
    if (!settings.sound) return;
    
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 1.5);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.0);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 2.1);
}

// SVG Progress Ring setup
const radius = progressCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

function setProgress(percent) {
    const offset = circumference - percent / 100 * circumference;
    progressCircle.style.strokeDashoffset = offset;
    
    const pipProgressFill = document.getElementById('pipProgressFill');
    if (pipProgressFill) {
        pipProgressFill.style.width = percent + '%';
    }
}

// Format Time (MM:SS)
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Update Display
function updateDisplay() {
    timeDisplay.textContent = formatTime(timerState.timeLeft);
    const progress = (timerState.timeLeft / timerState.totalTime) * 100;
    setProgress(progress);
    document.title = `${formatTime(timerState.timeLeft)} - Pomodoro`;
}

// Timer Controls
function setMode(mode) {
    timerState.mode = mode;
    let mins = 25;
    if (mode === 'focus') mins = settings.focus;
    if (mode === 'shortBreak') mins = settings.shortBreak;
    if (mode === 'longBreak') mins = settings.longBreak;
    
    timerState.totalTime = mins * 60;
    timerState.timeLeft = timerState.totalTime;
    
    // Update active button
    modeBtns.forEach(btn => {
        if (btn.dataset.mode === mode) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    if (timerState.isRunning) {
        pauseTimer();
    }
    updateDisplay();
}

function startTimer() {
    if (timerState.isRunning) return;
    timerState.isRunning = true;
    startPauseBtn.textContent = 'Pause';
    
    timerState.interval = setInterval(() => {
        timerState.timeLeft--;
        updateDisplay();
        
        if (timerState.timeLeft <= 0) {
            timerFinished();
        }
    }, 1000);
}

function pauseTimer() {
    timerState.isRunning = false;
    startPauseBtn.textContent = 'Start';
    clearInterval(timerState.interval);
}

function toggleTimer() {
    if (timerState.isRunning) pauseTimer();
    else startTimer();
}

function timerFinished() {
    pauseTimer();
    playSoftChime();
    recordSession();
    
    // Auto transition to next logical state could be added here, 
    // but a manual start is often preferred.
    if (timerState.mode === 'focus') {
        setMode('shortBreak');
    } else {
        setMode('focus');
    }
}

function skipTimer() {
    if (timerState.timeLeft < timerState.totalTime) {
        // Record if some time was spent? We'll just finish it.
        timerFinished();
    }
}

// Save & Load Data
function loadData() {
    const savedSettings = localStorage.getItem('pomodoroSettings');
    if (savedSettings) {
        settings = { ...settings, ...JSON.parse(savedSettings) };
    }
    
    const savedSessions = localStorage.getItem('pomodoroSessions');
    if (savedSessions) {
        sessions = JSON.parse(savedSessions);
    }
    
    applySettingsToDOM();
}

function saveData() {
    localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
    localStorage.setItem('pomodoroSessions', JSON.stringify(sessions));
}

// Metrics & Sessions
function recordSession() {
    const durationMins = Math.floor(timerState.totalTime / 60);
    sessions.push({
        id: Date.now(),
        date: new Date().toISOString(),
        mode: timerState.mode,
        duration: durationMins
    });
    saveData();
    updateMetricsUI();
}

function updateMetricsUI() {
    const today = new Date().toDateString();
    
    let todayFocusMins = 0;
    let todaySessionsCount = 0;
    
    sessionsList.innerHTML = '';
    
    // Sort reverse chronological
    const sortedSessions = [...sessions].sort((a,b) => b.id - a.id);
    
    sortedSessions.forEach(session => {
        const d = new Date(session.date);
        const isToday = d.toDateString() === today;
        
        if (isToday && session.mode === 'focus') {
            todayFocusMins += session.duration;
            todaySessionsCount++;
        }
        
        // Add to list
        const el = document.createElement('div');
        el.className = 'session-item';
        
        const modeLabel = session.mode === 'focus' ? 'Focus' : 
                         (session.mode === 'shortBreak' ? 'Short Break' : 'Long Break');
                         
        el.innerHTML = `
            <span>${modeLabel} (${session.duration}m)</span>
            <span>${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        `;
        sessionsList.appendChild(el);
    });
    
    if (sortedSessions.length === 0) {
        sessionsList.innerHTML = '<div class="session-item">No sessions recorded yet!</div>';
    }
    
    statFocusTime.textContent = todayFocusMins;
    statSessions.textContent = todaySessionsCount;
}

// CSV Export
function exportCSV() {
    if (sessions.length === 0) {
        alert("No sessions to export!");
        return;
    }
    
    let csvContent = "Date,Time,Mode,Duration (minutes)\n";
    
    sessions.forEach(s => {
        const d = new Date(s.date);
        const dateStr = d.toLocaleDateString();
        const timeStr = d.toLocaleTimeString();
        const modeStr = s.mode;
        csvContent += `"${dateStr}","${timeStr}","${modeStr}",${s.duration}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pomodoro_metrics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Settings UI Control
function applySettingsToDOM() {
    focusInput.value = settings.focus;
    shortInput.value = settings.shortBreak;
    longInput.value = settings.longBreak;
    soundToggle.checked = settings.sound;
    
    document.body.setAttribute('data-theme', settings.theme);
    
    themeOptions.forEach(opt => {
        if (opt.dataset.theme === settings.theme) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
    
    setMode(timerState.mode); // Refresh timer with new potential config
}

function saveSettingsFromUI() {
    settings.focus = parseInt(focusInput.value) || 25;
    settings.shortBreak = parseInt(shortInput.value) || 5;
    settings.longBreak = parseInt(longInput.value) || 15;
    settings.sound = soundToggle.checked;
    
    const selectedTheme = document.querySelector('.theme-option.selected');
    if (selectedTheme) settings.theme = selectedTheme.dataset.theme;
    
    saveData();
    applySettingsToDOM();
    settingsModal.classList.remove('show');
}

// Event Listeners
startPauseBtn.addEventListener('click', toggleTimer);
skipBtn.addEventListener('click', skipTimer);

modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => setMode(e.target.dataset.mode));
});

settingsBtn.addEventListener('click', () => {
    applySettingsToDOM(); // Re-sync UI just in case
    settingsModal.classList.add('show');
});

metricsBtn.addEventListener('click', () => {
    updateMetricsUI();
    metricsModal.classList.add('show');
});

closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('show');
    });
});

// Click outside modal to close
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
});

themeOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
        themeOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        // Live preview theme
        document.body.setAttribute('data-theme', opt.dataset.theme);
    });
});

saveSettingsBtn.addEventListener('click', saveSettingsFromUI);
exportCsvBtn.addEventListener('click', exportCSV);

// Document Picture-in-Picture Logic
if ('documentPictureInPicture' in window) {
    pipBtn.style.display = 'flex';
    let pipWindow = null;

    pipBtn.addEventListener('click', async () => {
        if (pipWindow) return; // already in PiP

        try {
            pipWindow = await window.documentPictureInPicture.requestWindow({
                width: 250,
                height: 300
            });

            // Copy all styles to the new window
            [...document.styleSheets].forEach((styleSheet) => {
                try {
                    const cssRules = [...styleSheet.cssRules].map(rule => rule.cssText).join('');
                    const style = document.createElement('style');
                    style.textContent = cssRules;
                    pipWindow.document.head.appendChild(style);
                } catch(e) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.type = styleSheet.type;
                    link.media = styleSheet.media;
                    link.href = styleSheet.href;
                    pipWindow.document.head.appendChild(link);
                }
            });

            // Set up PiP window body
            pipWindow.document.body.classList.add('is-pip-mode');
            pipWindow.document.body.setAttribute('data-theme', document.body.getAttribute('data-theme'));

            // Move content to PiP window
            pipWindow.document.body.appendChild(pipContent);

            // Hide the pip button visually on main page to show it's active
            pipBtn.style.opacity = '0.5';
            pipBtn.style.pointerEvents = 'none';

            // When PiP closes, move content back
            pipWindow.addEventListener("pagehide", (event) => {
                const appContainer = document.querySelector('.app-container');
                // Insert back before the next sibling (modals are after app container, 
                // but since it's the last child of app-container, just append)
                appContainer.appendChild(pipContent);
                pipWindow = null;
                pipBtn.style.opacity = '1';
                pipBtn.style.pointerEvents = 'all';
            });
        } catch (error) {
            console.error("Failed to enter Picture-in-Picture mode", error);
            alert("Picture-in-Picture is not supported or was blocked.");
        }
    });

    // Support theme switching for PiP window dynamically
    themeOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
            if (pipWindow) {
                pipWindow.document.body.setAttribute('data-theme', opt.dataset.theme);
            }
        });
    });
}

// Init
loadData();
updateMetricsUI();
updateDisplay();
