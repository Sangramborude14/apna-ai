// OptiSync Persistent Edge-AI Offscreen Engine
let lastTime = performance.now();

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const video = document.getElementById('webcam');
        video.srcObject = stream;
        video.play();
        
        /**
         * [EDGE AI INTEGRATION POINT] 
         * Manifest V3 blocks remote code execution. To run real MediaPipe here, 
         * download the `@mediapipe/tasks-vision` library locally, import it, and hook 
         * up FaceLandmarker.detectForVideo(video, now).
         */

        // Initiating hybrid tracking loop
        requestAnimationFrame(trackingLoop);
    } catch (e) {
        console.error("OptiSync Camera access denied:", e);
    }
}

function trackingLoop(time) {
    const dt = time - lastTime;
    lastTime = time;

    // --- SIMULATED AI PIPELINE ---
    // Simulating EAR calculation (Eye Aspect Ratio)
    // Most of the time eyes are open (~0.3), random drops represent blinks (~0.1)
    const isBlinking = Math.random() < 0.05; // 5% chance per frame to blink 
    const ear = isBlinking ? 0.15 : 0.30;
    
    // Simulating Head Pose (Pitch/Yaw) from facial transformation matrices
    // Over the course of testing, simulate the user turning their head away
    const cycle = Date.now() % 40000;
    const isLookingAway = cycle > 20000 && cycle < 30000; // Look away simulated window
    
    const pitch = isLookingAway ? 0.45 : (Math.random() * 0.05);
    const yaw = isLookingAway ? -0.50 : (Math.random() * 0.05);

    try {
        chrome.runtime.sendMessage({
            type: 'TELEMETRY',
            data: {
                ear: ear,
                pitch: pitch,
                yaw: yaw,
                dt: dt
            }
        });
    } catch(e) {}

    // Throttle loop to roughly ~15 FPS to save battery while running forever in background
    setTimeout(() => {
        requestAnimationFrame(trackingLoop);
    }, 66);
}

startWebcam();
