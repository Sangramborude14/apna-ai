let timerId = null;

self.onmessage = function(e) {
    if (e.data.command === 'start') {
        const fps = e.data.fps || 30;
        const interval = 1000 / fps;
        
        timerId = setInterval(() => {
            self.postMessage('tick');
        }, interval);
    } else if (e.data.command === 'stop') {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }
};
