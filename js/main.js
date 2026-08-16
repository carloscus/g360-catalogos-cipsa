// Main initialization - loaded by index.html
import { pdfLoader } from './pdfLoader.js';
import { audioSystem } from './audio.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('CIPSA Catalogos Shelf v1.0.0');
  console.log('Audio system:', audioSystem.isMuted() ? 'muted' : 'active');
});
