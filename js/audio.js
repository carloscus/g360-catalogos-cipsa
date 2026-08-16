class AudioSystem {
  constructor() {
    this.muted = localStorage.getItem('catalog-audio-muted') === 'true';
    this.sounds = {};
    this.init();
  }
  async init() {
    try {
      const base = 'sounds/';
      this.sounds = {
        flip: await this.loadSound(base + 'flip-page.mp3'),
        hover: await this.loadSound(base + 'hover-card.mp3'),
        open: await this.loadSound(base + 'open-catalog.mp3'),
        error: await this.loadSound(base + 'error.mp3'),
        jump: await this.loadSound(base + 'jump-page.mp3')
      };
    } catch (e) { console.log('Audio not available'); }
  }
  async loadSound(src) {
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      const arrayBuf = await resp.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
      return { audioCtx, buffer: audioBuf };
    } catch (e) { return null; }
  }
  play(name) {
    if (this.muted) return;
    const sound = this.sounds[name];
    if (!sound || !sound.buffer) return;
    try {
      const source = sound.audioCtx.createBufferSource();
      source.buffer = sound.buffer;
      source.connect(sound.audioCtx.destination);
      source.start(0);
    } catch (e) {}
  }
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('catalog-audio-muted', this.muted);
    return this.muted;
  }
  isMuted() { return this.muted; }
}

export const audioSystem = new AudioSystem();
