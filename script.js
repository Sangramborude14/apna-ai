import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import { initNotifications, triggerFatigueNotification } from "./notifications/fatigue_alert.js";

const bgWorker = new Worker('./facemesh.worker.js');
bgWorker.onmessage = () => {
    if (webcamRunning) {
        processFrame();
    }
};

/** 🧠 THE NEURAL ENGINE V3 **/
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const interventionOverlay = document.getElementById("intervention-overlay");
const fatigueBar = document.getElementById("fatigue-bar");
const fatigueScoreText = document.getElementById("fatigue-score");
const systemLogs = document.getElementById("system-messages");

let faceLandmarker;
let webcamRunning = false;
let isInterventionActive = false;

// Multi-variate Fatigue Metrics
let blinkCounts = [];
let lastBlinkTime = performance.now();
let fatigueScore = 0;
let jitterHistory = [];

// Game State
let currentStage = 1; // 1: Saccadic, 2: Pursuit, 3: Depth
let stageStartTime = 0;
let initialNosePos = null;
let stageCompleted = false;
let gameTimeRef = 0; // Cumulative time while focused
let lastFrameTime = performance.now();

/** 🚀 INITIALIZATION **/
async function init() {
    log("Synchronizing Neural Ocular Sentinel...");
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
    });

    document.getElementById("status-chip").innerText = "SENTINEL ACTIVE";
    document.getElementById("status-chip").className = "chip active";
    log("Engine Online. Monitoring optical pathways...");
    startWebcam();
}

async function startWebcam() {
    const constraints = { video: { width: 1280, height: 720 } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
        webcamRunning = true;
        bgWorker.postMessage({ command: 'start', fps: 30 });
    });
}

/** 👁️ PROCESSING LOOP **/
let lastVideoTime = -1;
const drawingUtils = new DrawingUtils(canvasCtx);

async function processFrame() {
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const results = faceLandmarker.detectForVideo(video, performance.now());

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            
            // Visual Overlay
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#6366f120", lineWidth: 1 });
            
            // 🤖 CALCULATE MULTI-METRIC FATIGUE
            updateNeuralMetrics(results);
            
            // 🎮 GAMEPLAY LOGIC
            if (isInterventionActive) {
                runTherapyCombo(landmarks);
            }
        }
    }
    // Frame looping is now driven purely by the background Web Worker tick to prevent browser throttling when the tab is hidden
}

/** 📊 THE ADVANCED FATIGUE MODEL **/
function updateNeuralMetrics(results) {
    const now = performance.now();
    const landmarks = results.faceLandmarks[0];
    const nose = landmarks[1];

    // 1. EAR Calculation
    const ear = calculateEAR(landmarks);
    document.getElementById("ear-live")?.remove(); // Cleanup old elements if any
    
    // 2. Blink Density (Blinks per minute)
    if (ear < 0.22 && !window.isBlinkingInternal) {
        blinkCounts.push(now);
        lastBlinkTime = now;
        window.isBlinkingInternal = true;
    } else if (ear > 0.25) {
        window.isBlinkingInternal = false;
    }
    
    // Clean old blinks (> 1 min)
    blinkCounts = blinkCounts.filter(t => now - t < 60000);
    const bpm = blinkCounts.length;
    document.getElementById("blink-rate").innerText = bpm;

    // 3. Jitter (Fixation Stability)
    jitterHistory.push({ x: nose.x, y: nose.y });
    if (jitterHistory.length > 10) jitterHistory.shift();
    const jitter = calculateJitter(jitterHistory);
    document.getElementById("jitter-val").innerText = jitter.toFixed(2);

    // 🚀 STABILIZED FATIGUE INTEGRATION (IFI)
    // We use a MUCH slower smoothing factor (0.005 instead of 0.05) to prevent movement spikes
    const stareTime = (now - lastBlinkTime) / 1000;
    let targetFatigue = 0;
    
    // Penalize low blink rate and long stares, ignore jitter for score (use jitter only for telemetry)
    if (bpm < 8) targetFatigue += (8 - bpm) * 4; 
    if (stareTime > 15) targetFatigue += (stareTime - 15) * 5;

    // Heavy smoothing to ensure the score evolves over minutes, not seconds
    fatigueScore = (fatigueScore * 0.998) + (targetFatigue * 0.002);
    
    fatigueBar.style.width = `${fatigueScore}%`;
    fatigueScoreText.innerText = `${Math.floor(fatigueScore)}%`;

    const label = document.getElementById("strain-label");
    if (fatigueScore > 75) { label.innerText = "CRITICAL"; label.style.color = "var(--danger)"; }
    else if (fatigueScore > 35) { label.innerText = "MODERATE"; label.style.color = "#fbbf24"; }
    else { label.innerText = "OPTIMAL"; label.style.color = "var(--success)"; }

    if (fatigueScore >= 75 && !isInterventionActive) {
        triggerFatigueNotification();
        triggerIntervention();
    }
}

/** 🎮 THE OCULAR TRIFECTA GAME LOGIC **/
function triggerIntervention() {
    isInterventionActive = true;
    currentStage = 1;
    stageStartTime = performance.now();
    initialNosePos = null;
    interventionOverlay.classList.remove("hidden");
    updateStageUI();
    log("!!! FATIGUE THRESHOLD REACHED: Starting Recovery Cycle !!!");
}

function runTherapyCombo(landmarks) {
    const nose = landmarks[1];
    if (!initialNosePos) initialNosePos = { x: nose.x, y: nose.y };
    const now = performance.now();
    const deltaTime = (now - lastFrameTime);
    lastFrameTime = now;
    const elapsed = (now - stageStartTime) / 1000;

    // Head Movement Check (Relaxed slightly to prevent frustration)
    const headShift = Math.sqrt(Math.pow(nose.x - initialNosePos.x, 2) + Math.pow(nose.y - initialNosePos.y, 2));
    const headWarning = document.getElementById("head-warning");
    
    if (headShift > 0.08) {
        headWarning.classList.remove("hidden");
        return; 
    } else {
        headWarning.classList.add("hidden");
    }

    // Manual Progression Control
    const nextBtn = document.getElementById("next-stage-btn");
    const timeLeft = Math.max(0, 30 - elapsed);
    
    if (timeLeft > 0) {
        nextBtn.innerText = `LOCKED (${Math.ceil(timeLeft)}s)`;
        nextBtn.disabled = true;
        nextBtn.style.opacity = "0.3";
    } else {
        nextBtn.innerText = currentStage === 3 ? "COMPLETE RECOVERY" : "NEXT PHASE ➔";
        nextBtn.disabled = false;
        nextBtn.style.opacity = "1";
        nextBtn.classList.add("pulse-btn");
    }

    const noseX = (1 - nose.x) * 100;
    const noseY = nose.y * 100;

    if (currentStage === 1) handleNebulaStage(noseX, noseY, deltaTime);
    else if (currentStage === 2) handleInfinityStage(noseX, noseY, deltaTime);
    else if (currentStage === 3) handleDepthStage(noseX, noseY, deltaTime);

    updateProgress();
}

function handleNebulaStage(nx, ny, dt) {
    const targets = document.querySelectorAll(".nebula-target");
    // Only advance the active target index if we are focused on the current one
    const activeIdx = Math.floor((gameTimeRef / 1500) % 4);
    targets.forEach((t, i) => t.classList.toggle("active", i === activeIdx));

    const activeTarget = targets[activeIdx];
    const rect = activeTarget.getBoundingClientRect();
    const parentRect = activeTarget.parentElement.getBoundingClientRect();
    const tx = ((rect.left + rect.width/2 - parentRect.left) / parentRect.width) * 100;
    const ty = ((rect.top + rect.height/2 - parentRect.top) / parentRect.height) * 100;

    if (Math.sqrt(Math.pow(nx - tx, 2) + Math.pow(ny - ty, 2)) < 15) {
        gameTimeRef += dt; // Only rotate targets while looking
        stageCompleted = true; // Technically progress is time-based, but eye contact is required
    }
}

function handleInfinityStage(nx, ny, dt) {
    const orb = document.getElementById("infinity-orb");
    orb.classList.remove("hidden");
    
    // Smooth Pursuit only moves while eye is on it
    const time = gameTimeRef / 2000;
    const tx = 50 + (35 * Math.sin(time));
    const ty = 50 + (25 * Math.sin(time) * Math.cos(time));
    
    orb.style.left = `${tx}%`;
    orb.style.top = `${ty}%`;

    if (Math.sqrt(Math.pow(nx - tx, 2) + Math.pow(ny - ty, 2)) < 12) {
        gameTimeRef += dt; // Orb moves ONLY when user looks at it
    }
}

function handleDepthStage(nx, ny, dt) {
    const pulsar = document.getElementById("depth-pulsar");
    pulsar.classList.remove("hidden");
    
    // Depth Pulsar only pulses while focused
    if (Math.sqrt(Math.pow(nx - 50, 2) + Math.pow(ny - 50, 2)) < 15) {
        gameTimeRef += dt;
        // Visual pulsing feedback tied to gameTimeRef
        const scale = 1 + 0.5 * Math.sin(gameTimeRef / 500);
        pulsar.style.transform = `scale(${scale})`;
    }
}

function updateProgress() {
    // Progress bar visualization (shows 30s countdown)
    const elapsed = (performance.now() - stageStartTime) / 1000;
    const percent = Math.min(100, (elapsed / 30) * 100);
    document.getElementById("game-progress").style.width = `${percent}%`;
}

// Attachment for the Next Button (New function)
window.moveToNextStage = () => {
    currentStage++;
    gameTimeRef = 0; // Reset for next stage
    if (currentStage > 3) {
        completeIntervention();
    } else {
        stageStartTime = performance.now();
        updateStageUI();
        log(`Entering Phase ${currentStage}...`);
    }
};

function updateStageUI() {
    const titles = ["", "WARMUP: Nebula Saccades", "RECOVERY: Celestial Infinity", "FOCUS: Depth Recalibration"];
    const descs = ["", "Quickly shift your gaze to the flashing targets.", "Smoothly follow the orb while keeping your head still.", "Adopt a deep focus on the pulsing core."];
    
    document.getElementById("stage-title").innerText = titles[currentStage];
    document.getElementById("stage-desc").innerText = descs[currentStage];
    
    document.querySelectorAll(".step").forEach((s, i) => s.classList.toggle("active", i+1 === currentStage));
    
    // Reset element visibility
    document.querySelectorAll(".nebula-target").forEach(t => t.classList.add("hidden"));
    if (currentStage === 1) document.querySelectorAll(".nebula-target").forEach(t => t.classList.remove("hidden"));
    document.getElementById("infinity-orb").classList.add("hidden");
    document.getElementById("depth-pulsar").classList.add("hidden");
}

function completeIntervention() {
    isInterventionActive = false;
    fatigueScore = 0;
    interventionOverlay.classList.add("hidden");
    log("Ocular Trifecta Complete. Vision Refreshed.");
}

/** 🛠️ UTILS **/
function calculateEAR(landmarks) {
    const dist = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    const v1 = dist(landmarks[160], landmarks[144]);
    const v2 = dist(landmarks[158], landmarks[153]);
    const h = dist(landmarks[33], landmarks[133]);
    return (v1 + v2) / (2 * h);
}

function calculateJitter(history) {
    if (history.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < history.length; i++) {
        total += Math.sqrt(Math.pow(history[i].x - history[i-1].x, 2) + Math.pow(history[i].y - history[i-1].y, 2));
    }
    return (total / history.length) * 1000;
}

function log(msg) {
    const div = document.createElement("div");
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    systemLogs.prepend(div);
}

document.getElementById("toggle-guardian").onclick = () => {
    initNotifications();
    init();
};
document.getElementById("debug-trigger").onclick = () => {
    triggerFatigueNotification();
    triggerIntervention();
};
document.getElementById("reset-btn").onclick = () => location.reload();
