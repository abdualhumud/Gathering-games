import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, getServerUrl } from '../socket';

// One hook for all online games.
//  status: 'no-server' | 'connecting' | 'online' | 'offline'
//  state:  the latest `room:state` from the server (null when not in a room)
// The seat (room code + secret token) is kept per game in localStorage, so a
// refresh or a phone waking from sleep re-joins the same seat automatically.
const seatKey = game => `gg-room-${game}`;
const loadSeat = game => { try { return JSON.parse(localStorage.getItem(seatKey(game)) || 'null'); } catch { return null; } };
const saveSeat = (game, seat) => { try { seat ? localStorage.setItem(seatKey(game), JSON.stringify(seat)) : localStorage.removeItem(seatKey(game)); } catch { /* ignore */ } };

const ACK_TIMEOUT = 8000;

export function useRoom(game) {
  const [serverUrl, setUrl] = useState(getServerUrl);
  const [rawStatus, setStatus] = useState('connecting');
  const status = serverUrl ? rawStatus : 'no-server';
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const socketRef = useRef(null);

  const request = useCallback((event, data) => new Promise(resolve => {
    const s = socketRef.current;
    if (!s || !s.connected) { resolve({ ok: false, error: 'لا يوجد اتصال بالخادم' }); return; }
    s.timeout(ACK_TIMEOUT).emit(event, data, (err, res) => {
      resolve(err ? { ok: false, error: 'الخادم لم يرد — حاول مرة أخرى' } : (res || { ok: false }));
    });
  }), []);

  const tryRejoin = useCallback(async () => {
    const seat = loadSeat(game);
    if (!seat) return;
    const res = await request('room:rejoin', { game, code: seat.code, token: seat.token });
    if (!res.ok) {
      saveSeat(game, null);
      setState(null);
      if (res.gone) setNotice('انتهت الغرفة السابقة');
    }
  }, [game, request]);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    if (!s) return undefined;
    const onConnect = () => { setStatus('online'); setError(''); tryRejoin(); };
    const onDisconnect = () => setStatus('offline');
    const onConnectError = () => setStatus(st => (st === 'online' ? 'offline' : 'offline'));
    const onState = st => { if (st.game === game) setState(st); };
    const onGone = msg => () => { saveSeat(game, null); setState(null); setNotice(msg); };
    const onKicked = onGone('أخرجك المضيف من الغرفة');
    // the seat moved to another tab of this device — keep the saved seat for that tab
    const onReplaced = () => { setState(null); setNotice('فُتحت نفس الجلسة في نافذة أخرى'); };
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on('room:state', onState);
    s.on('room:kicked', onKicked);
    s.on('room:replaced', onReplaced);
    if (s.connected) onConnect(); else s.connect();
    // Mobile browsers freeze background tabs: reconnect as soon as we're visible again.
    const wake = () => { if (document.visibilityState === 'visible' && !s.connected) s.connect(); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('room:state', onState);
      s.off('room:kicked', onKicked);
      s.off('room:replaced', onReplaced);
      document.removeEventListener('visibilitychange', wake);
      s.disconnect();
    };
  }, [game, serverUrl, tryRejoin]);

  const enter = useCallback(async (event, data) => {
    setError(''); setNotice('');
    const res = await request(event, { game, ...data });
    if (res.ok) saveSeat(game, { code: res.code, token: res.token });
    else setError(res.error || 'تعذّر الدخول');
    return res;
  }, [game, request]);

  const create = useCallback((name, extra = {}) => enter('room:create', { name, ...extra }), [enter]);
  const join = useCallback((code, name, extra = {}) => enter('room:join', { code, name, ...extra }), [enter]);

  const act = useCallback(async (type, data = {}) => {
    const res = await request('room:action', { type, ...data });
    if (!res.ok && res.error) { setError(res.error); setTimeout(() => setError(e => (e === res.error ? '' : e)), 2500); }
    if (res.gone) { saveSeat(game, null); setState(null); }
    return res;
  }, [game, request]);

  const leave = useCallback(async () => {
    saveSeat(game, null);
    setState(null);
    await request('room:leave', {});
  }, [game, request]);

  const changeServer = useCallback(url => { setStatus('connecting'); setUrl(url); }, []);

  const me = state ? state.players.find(p => p.id === state.youId) : null;
  return { status, state, me, error, notice, setError, create, join, act, leave, serverUrl, changeServer };
}

/** True when this device holds a seat in a room of `game` (used to resume after refresh). */
export const hasSeat = game => !!loadSeat(game);
