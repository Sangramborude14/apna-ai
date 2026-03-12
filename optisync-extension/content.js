// OptiSync Content Script 

// ==========================================
// FEATURE 2: PRODUCTIVITY (FLOW STATE) TRACKER
// ==========================================
let keyPresses = 0;
let mouseDistance = 0;
let lastMousePos = null;

// Track actions non-invasively
document.addEventListener('keydown', () => keyPresses++);
document.addEventListener('mousemove', (e) => {
  if (lastMousePos) {
    mouseDistance += Math.abs(e.clientX - lastMousePos.x) + Math.abs(e.clientY - lastMousePos.y);
  }
  lastMousePos = { x: e.clientX, y: e.clientY };
});

// Evaluate productivity window every 2 seconds
setInterval(() => {
  // Define "Flow State": ~40 WPM (roughly 6-7 keys per 2 sec) OR heavy mouse tracking
  const isFlowState = keyPresses > 6 || mouseDistance > 1500;
  
  try {
    chrome.runtime.sendMessage({
      type: 'PRODUCTIVITY',
      data: { isFlowState }
    });
  } catch(e) {}

  // Flush metrics
  keyPresses = 0;
  mouseDistance = 0;
}, 2000);

// ==========================================
// FEATURE 1 & 3: RENDERING ENGINE (UI)
// ==========================================

function injectUI() {
    if (document.getElementById('optisync-widget')) return;

    // Feature 1: The Ambient Traffic Light Widget
    const widget = document.createElement('div');
    widget.id = 'optisync-widget';
    widget.innerHTML = `<div id="optisync-dot" class="dot-green"></div><span id="optisync-text">0%</span>`;
    document.body.appendChild(widget);

    // Feature 3: Action-Based Modal
    const modal = document.createElement('div');
    modal.id = 'optisync-modal';
    modal.className = 'hidden';
    modal.innerHTML = `
      <div class="optisync-wrap">
        <h2 class="opti-header">Severe Eye Strain Detected</h2>
        <p class="opti-instruction">Look away from the screen for 5 seconds to dismiss.</p>
        <div class="opti-progress-bar">
          <div id="opti-progress-fill"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
}

// Ensure DOM is ready before injecting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
} else {
    injectUI();
}

// Receive UI state overrides from Background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE') {
    const { strainLevel, modalActive, progress } = message;
    
    // --- Update Widget
    const widgetText = document.getElementById('optisync-text');
    const dot = document.getElementById('optisync-dot');
    
    if (widgetText && dot) {
        const roundedStrain = Math.min(100, Math.floor(strainLevel));
        widgetText.innerText = `${roundedStrain}%`;
        
        dot.className = roundedStrain < 40 ? 'dot-green' : (roundedStrain <= 79 ? 'dot-yellow' : 'dot-red');
    }

    // --- Update Modal
    const modal = document.getElementById('optisync-modal');
    if (modal) {
        if (modalActive) {
            modal.classList.remove('hidden');
            const progressFill = document.getElementById('opti-progress-fill');
            if (progressFill) {
                 // Map progress to width (0-100%)
                 progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            }
        } else {
            modal.classList.add('hidden');
        }
    }
  }
});
