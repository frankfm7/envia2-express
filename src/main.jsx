import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App';
import { applyAppearance } from './lib/appearance';

applyAppearance();
// Pide al navegador guardar los datos de la app de forma permanente (no borrar la sesión)
navigator.storage?.persist?.().catch(() => {});
// Busca la versión nueva de la app al abrir y cada vez que vuelve al frente (la app instalada no siempre se actualiza sola)
const checkUpdate = () => navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
document.addEventListener('visibilitychange', () => !document.hidden && checkUpdate());
setInterval(checkUpdate, 30 * 60 * 1000);
// Cuando se instala la versión nueva, la app se recarga sola (una vez) para usarla
if (navigator.serviceWorker?.controller) navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
