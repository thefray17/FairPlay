import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Root} from './Root.tsx';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="FairPlay Club Session">
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if ((import.meta as any).env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => {
          console.warn('FairPlay PWA ServiceWorker registration failed:', err);
        });
    });
  } else {
    // In development mode, unregister any active service worker and clear caches to avoid stale chunks
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          if (name.startsWith('fairplay-')) {
            caches.delete(name);
          }
        }
      });
    }
  }
}


