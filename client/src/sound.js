// Tiny synthesized sound effects (Web Audio) — no audio files to download.
//   play('buzz' | 'correct' | 'wrong' | 'tick' | 'timeup' | 'win' | 'start')
// Muting is remembered per device (localStorage "gg-muted").
import { useEffect, useRef, useSyncExternalStore } from 'react';

const KEY = 'gg-muted';
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
const listeners = new Set();
let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow audio after a user gesture: unlock on the first tap/key.
if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(c, { freq, to, type = 'sine', at = 0, dur = 0.15, vol = 0.18 }) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  buzz:    c => { tone(c, { freq: 440, type: 'square', dur: 0.12, vol: 0.12 }); tone(c, { freq: 660, type: 'square', at: 0.1, dur: 0.22, vol: 0.12 }); },
  correct: c => { [523, 659, 784].forEach((f, i) => tone(c, { freq: f, at: i * 0.09, dur: 0.22, vol: 0.16 })); },
  wrong:   c => { tone(c, { freq: 220, to: 120, type: 'sawtooth', dur: 0.38, vol: 0.12 }); },
  tick:    c => { tone(c, { freq: 1200, type: 'triangle', dur: 0.05, vol: 0.08 }); },
  timeup:  c => { [660, 520, 380].forEach((f, i) => tone(c, { freq: f, type: 'square', at: i * 0.16, dur: 0.14, vol: 0.1 })); },
  start:   c => { tone(c, { freq: 300, to: 900, type: 'triangle', dur: 0.3, vol: 0.12 }); },
  win:     c => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(c, { freq: f, at: i * 0.12, dur: 0.24, vol: 0.15 })); },
};

export function play(name) {
  if (muted) return;
  const c = audio();
  const fn = SOUNDS[name];
  if (c && fn) { try { fn(c); } catch { /* ignore */ } }
}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach(l => l());
}
const subscribe = l => { listeners.add(l); return () => listeners.delete(l); };
export const useMuted = () => useSyncExternalStore(subscribe, isMuted);

/**
 * Plays `sound` whenever `key` changes to a new truthy value.
 * The very first value is skipped, so re-opening a screen (or re-joining a
 * room) does not replay an old event.
 */
export function useCue(key, sound) {
  const prev = useRef(undefined);
  useEffect(() => {
    if (prev.current !== undefined && key && key !== prev.current && sound) play(sound);
    prev.current = key || null;
  }, [key, sound]);
}
