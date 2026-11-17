// Small helpers shared by the room screens.

/** Room code from the invite link (#/game?room=CODE). */
export function inviteCode() {
  const m = window.location.hash.match(/[?&]room=([A-Za-z0-9]{4,8})/);
  return m ? m[1].toUpperCase() : '';
}

export function inviteLink(code) {
  const base = window.location.href.split('#')[0];
  const route = (window.location.hash.split('?')[0] || '#/').replace(/^#/, '');
  return `${base}#${route}?room=${code}`;
}

/** Converts the server timer into props for <Timer>. */
export function timerProps(timer) {
  if (!timer) return { duration: 0, total: 1, running: false };
  return { duration: timer.remaining, total: timer.duration, running: true };
}
export const timerKey = timer => (timer ? `t${timer.key}` : 'none');
