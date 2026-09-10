/* Service worker: cachea la app entera para que funcione sin conexión.
   Sube el número de CACHE cada vez que cambies un archivo.

   Estrategia:
   - Navegación (abrir la app): RED PRIMERO con 2,5 s de margen y, si no hay
     red, la copia guardada. Así una versión nueva entra en cuanto hay
     cobertura, en vez de quedarse una copia vieja pegada para siempre.
   - Resto de archivos: caché primero (rápido y sólido sin conexión). Cada
     versión se precarga entera en 'install', así que no se mezclan archivos
     de dos versiones distintas.
*/
const CACHE = 'rutina3mas1-v4';
const MARGEN_RED = 2500;

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/rutina.js',
  './js/datos.js',
  './js/progresion.js',
  './js/volumen.js',
  './js/graficas.js',
  './js/app.js',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardar(req, resp) {
  if (!resp || resp.status !== 200 || resp.type === 'opaque') return;
  const copia = resp.clone();
  caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
}

async function redPrimero(req) {
  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), MARGEN_RED);
  try {
    const resp = await fetch(req, { signal: corta.signal });
    clearTimeout(reloj);
    guardar(req, resp);
    return resp;
  } catch (e) {
    clearTimeout(reloj);
    const guardada = (await caches.match(req)) || (await caches.match('./index.html'));
    if (guardada) return guardada;
    throw e;
  }
}

async function cachePrimero(req) {
  const guardada = await caches.match(req);
  if (guardada) return guardada;
  const resp = await fetch(req);
  guardar(req, resp);
  return resp;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') e.respondWith(redPrimero(e.request));
  else e.respondWith(cachePrimero(e.request));
});
