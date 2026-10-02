import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initCapacitorApp } from './utils/capacitor';

// Initialize Capacitor native platform detection and safe area classes
initCapacitorApp();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.update().catch(() => {});
      if (import.meta.env.DEV) {
        reg.unregister().catch(() => {});
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
