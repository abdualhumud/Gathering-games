import { io } from 'socket.io-client';

// Where is the game server?
//  1. a URL the user saved in the room screen («عنوان الخادم»)
//  2. VITE_SERVER_URL baked in at build time (GitHub Pages build → repo variable SERVER_URL)
//  3. local dev / preview → same host on port 3001
//  4. otherwise the site itself is served by the game server → same origin
const KEY = 'gg-server-url';

function stored() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function defaultServerUrl() {
  const env = import.meta.env.VITE_SERVER_URL;
  if (env) return env;
  const { hostname, protocol, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\./.test(hostname)) {
    return `${protocol}//${hostname}:3001`;
  }
  if (hostname.endsWith('github.io')) return '';   // static hosting: no server here
  return origin;
}

export function getServerUrl() { return stored() || defaultServerUrl(); }

export function normaliseUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

let current = null;
let currentUrl = null;

/** The shared socket for the configured server (recreated when the URL changes). */
export function getSocket() {
  const url = getServerUrl();
  if (!url) return null;
  if (current && currentUrl === url) return current;
  if (current) current.close();
  currentUrl = url;
  current = io(url, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 12000,
  });
  return current;
}

export function setServerUrl(raw) {
  const u = normaliseUrl(raw);
  try {
    if (u && u !== defaultServerUrl()) localStorage.setItem(KEY, u);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked */ }
  return getServerUrl();
}
