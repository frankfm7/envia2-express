// Netlify Function (gratis): envía notificaciones PUSH con Firebase Cloud Messaging.
// La app la llama en /.netlify/functions/push con el token de sesión de Firebase de quien envía.
// Necesita en Netlify la variable FIREBASE_SERVICE_ACCOUNT (ver GUIA-PUBLICAR.md → "Notificaciones push").
import admin from 'firebase-admin';

let ready = false;
function init() {
  if (ready) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  ready = true;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return json({ ok: false, error: 'falta FIREBASE_SERVICE_ACCOUNT en Netlify' }, 501);
  try {
    init();
  } catch (e) {
    return json({ ok: false, error: 'FIREBASE_SERVICE_ACCOUNT no es un JSON válido' }, 500);
  }

  // Solo personas con sesión iniciada en la app
  let caller;
  try {
    caller = await admin.auth().verifyIdToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  } catch {
    return json({ ok: false, error: 'sin sesión' }, 401);
  }

  const { to = [], topic = null, body = '', tag = '', url = './', urgent = false } = await req.json().catch(() => ({}));
  const db = admin.firestore();
  let uids = Array.isArray(to) ? to.filter((x) => typeof x === 'string').slice(0, 20) : [];
  // Grupos: administradores (soporte, solicitudes) y repartidores conectados (envío nuevo)
  if (topic === 'admins') (await db.collection('users').where('role', '==', 'admin').get()).forEach((d) => uids.push(d.id));
  if (topic === 'drivers') (await db.collection('users').where('role', '==', 'driver').where('online', '==', true).get()).forEach((d) => d.data().approved && uids.push(d.id));
  uids = [...new Set(uids)].filter((u) => u && u !== caller.uid && u !== 'admins');
  if (!uids.length) return json({ ok: true, sent: 0 });

  const owners = [];
  const tokens = [];
  for (const uid of uids) {
    const d = await db.collection('users').doc(uid).get();
    for (const t of d.exists ? d.data().pushTokens || [] : []) {
      tokens.push(t);
      owners.push(uid);
    }
  }
  if (!tokens.length) return json({ ok: true, sent: 0, note: 'sin dispositivos registrados' });

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { title: 'Envia2 Express', body: String(body).slice(0, 240), tag: String(tag || '').slice(0, 80), url: String(url || './').slice(0, 200), urgent: urgent ? '1' : '0' },
    webpush: { headers: { Urgency: urgent ? 'high' : 'normal', TTL: '86400' } },
  });

  // Limpia los dispositivos que ya no existen (app desinstalada, permiso quitado)
  await Promise.all(
    res.responses.map((r, i) => {
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument'))
        return db.collection('users').doc(owners[i]).update({ pushTokens: admin.firestore.FieldValue.arrayRemove(tokens[i]) }).catch(() => {});
      return null;
    })
  );
  return json({ ok: true, sent: res.successCount, failed: res.failureCount });
};
