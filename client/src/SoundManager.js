// SoundManager.js
// Synthetic audio generator for Walkie Talkie effects using Web Audio API

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
        this.gainNode.gain.value = 0.5; // Master volume
    }

    // Ensure AudioContext is resumed (browser policy)
    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 1. White Noise (Static)
    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds buffer
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    playStatic(duration = 0.5) {
        this.resume();
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();

        // Lowpass filter to make it sound more like radio static
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        // Envelope for smooth start/end
        const envelope = this.ctx.createGain();
        envelope.gain.setValueAtTime(0, this.ctx.currentTime);
        envelope.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.05);
        envelope.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(envelope);
        envelope.connect(this.gainNode);

        noise.start();
        noise.stop(this.ctx.currentTime + duration);
    }

    // 2. High Pitch Beep (Roger Beep)
    playBeep(frequency = 2500, duration = 0.1) {
        this.resume();
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        const envelope = this.ctx.createGain();
        envelope.gain.setValueAtTime(0, this.ctx.currentTime);
        envelope.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.01);
        envelope.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(envelope);
        envelope.connect(this.gainNode);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // 3. Click (PTT Press)
    playClick() {
        this.playStatic(0.1); // Short burst of static
    }

    // 4. Roger sequence (Beep + Static trail)
    playRoger() {
        this.playBeep(2500, 0.15); // High beep
        setTimeout(() => {
            this.playStatic(0.4); // Followed by static squelch
        }, 150);
    }
}

export default new SoundManager();
