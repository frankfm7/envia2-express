import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App';
import { applyAppearance } from './lib/appearance';

applyAppearance();
// Pide al navegador guardar los datos de la app de forma permanente (no borrar la sesión)
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
