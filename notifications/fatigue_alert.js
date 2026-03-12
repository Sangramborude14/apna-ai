// Handle high fatigue desktop notifications natively

export function initNotifications() {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission !== "denied" && Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            console.log("Notification permission:", permission);
        });
    }
}

let lastNotificationTime = 0;

export function triggerFatigueNotification() {
    const now = Date.now();
    // Only notify once every 60 seconds at most to prevent spam
    if (now - lastNotificationTime < 60000) return;

    if (Notification.permission === "granted") {
        const title = "High Fatigue Detected!";
        const options = {
            body: "Your Integrative Fatigue Index is critical. Please complete the Ocular Trifecta recovery sequence.",
            icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-11v4h2V9h-2zm0 6v2h2v-2h-2z'/></svg>",
            requireInteraction: true // Keeps the notification open until the user clicks it or dismisses it
        };
        
        const notification = new Notification(title, options);
        
        notification.onclick = () => {
            window.focus(); // Bring the tab back into focus
            notification.close();
        };

        lastNotificationTime = now;
    }
}
