import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initInstallPrompt } from './pwa/install';
import { initPwa } from './pwa/pwa';
import { applyReadingScale, applyTheme, useAppStore } from './state/store';
import './fonts.css';
import './styles.css';

// Reflect the persisted appearance choices before first paint.
const boot = useAppStore.getState();
applyTheme(boot.theme);
applyReadingScale(boot.readingScale);

initPwa();
// Must run before React mounts so an early `beforeinstallprompt` isn't missed.
initInstallPrompt();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
