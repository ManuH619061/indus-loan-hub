import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA service worker registration with vite-plugin-pwa
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // vite-plugin-pwa automatically generates and registers the service worker
      const registration = await navigator.serviceWorker.register('/sw.js', { 
        scope: '/',
        type: 'module'
      });
      
      console.log('PWA Service Worker registered successfully');
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              if (confirm('New version available! Reload to update?')) {
                window.location.reload();
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
