import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPwa } from './pwa/pwa';
import { applyReadingScale, applyTheme, useAppStore } from './state/store';
import './fonts.css';
import './styles.css';

// Reflect the persisted appearance choices before first paint.
const boot = useAppStore.getState();
applyTheme(boot.theme);
applyReadingScale(boot.readingScale);

initPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
