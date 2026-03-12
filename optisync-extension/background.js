// OptiSync Architecture - Central Brain
let strainLevel = 0;
let isProductive = false; // "Flow State" indicator
let modalActive = false;
let headAwayTimeMs = 0;

const STRAIN_MAX = 100;
const DISMISS_TIME_MS = 5000;

// 1. Initialize Offscreen Document for persistent webcam/AI tracking
async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Requires background webcam access for facial tracking'
  });
}

chrome.runtime.onInstalled.addListener(setupOffscreenDocument);
chrome.runtime.onStartup.addListener(setupOffscreenDocument);

// 2. Listen for Data Streams
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TELEMETRY') {
    handleBiometrics(message.data);
  } else if (message.type === 'PRODUCTIVITY') {
    handleProductivity(message.data);
  }
});

function handleBiometrics(data) {
  const { ear, pitch, yaw, dt } = data;

  if (modalActive) {
    // Stage 3 logic: User must look away to dismiss
    if (Math.abs(pitch) > 0.15 || Math.abs(yaw) > 0.15) {
      headAwayTimeMs += dt;
      if (headAwayTimeMs >= DISMISS_TIME_MS) {
        // Recovery complete!
        modalActive = false;
        strainLevel = 0;
        headAwayTimeMs = 0;
      }
    } else {
      // User is cheating and looking back at the screen
      headAwayTimeMs = Math.max(0, headAwayTimeMs - dt); 
    }
  } else {
    // Stage 2 logic: Dynamically adjust strain level
    // Low EAR means eyes are closed/blinking (good). High EAR is wide-open stare (bad).
    if (ear < 0.22) {
      strainLevel = Math.max(0, strainLevel - 5); // Rapidly relieve strain on blink
    } else {
      strainLevel = Math.min(STRAIN_MAX, strainLevel + 0.5); // Predictable buildup
    }
  }

  evaluateTriggerState();
}

function handleProductivity(data) {
  // If user is typing rapidly or moving mouse continuously, they are in a flow state
  isProductive = data.isFlowState;
  evaluateTriggerState();
}

// 3. The Smart Lock Trigger Validation
function evaluateTriggerState() {
  // Context-Aware Logic: Only interrupt if heavily strained AND NOT in a productivity flow
  if (strainLevel >= 80 && !isProductive && !modalActive) {
    modalActive = true;
    headAwayTimeMs = 0;
  }

  broadcastToTabs();
}

// Broadcast state to Content Scripts to update UI Widgets
function broadcastToTabs() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'STATE_UPDATE',
        strainLevel: strainLevel,
        modalActive: modalActive,
        progress: modalActive ? (headAwayTimeMs / DISMISS_TIME_MS) * 100 : 0
      }).catch(() => {}); // Catch disconnected port errors
    }
  });
}
