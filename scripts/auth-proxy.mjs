// Se ejecuta después de "vite build" (en Netlify).
// Hace que el inicio de sesión con Google pase por TU dominio (/__/auth/…) en vez de
// …firebaseapp.com. Así Chrome/Safari no bloquean la sesión y no la piden otra vez.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const project = process.env.VITE_FIREBASE_PROJECT_ID;
const on = process.env.VITE_AUTH_PROXY === 'true';
const file = 'dist/_redirects';
if (!project || !on) {
  console.log('auth-proxy: desactivado (falta VITE_FIREBASE_PROJECT_ID o VITE_AUTH_PROXY=true)');
  process.exit(0);
}
const rule = `/__/auth/*  https://${project}.firebaseapp.com/__/auth/:splat  200\n/__/firebase/*  https://${project}.firebaseapp.com/__/firebase/:splat  200\n`;
const prev = existsSync(file) ? readFileSync(file, 'utf8') : '';
writeFileSync(file, rule + prev);
console.log('auth-proxy: activado para', project);
