import { useEffect, useMemo, useState } from 'react';
import QR from 'qrcode';
import { getServerUrl, setServerUrl } from '../socket';
import { inviteCode, inviteLink } from './roomUtils';
import './RoomKit.css';

const NAME_KEY = 'gg-player-name';
const loadName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };


// ── Server status + address ───────────────────────────────────────────────────
export function ServerStatus({ room }) {
  const [open, setOpen] = useState(room.status === 'no-server');
  const [url, setUrl] = useState(getServerUrl());
  const label = {
    online: 'متصل بالخادم',
    connecting: 'جارٍ الاتصال بالخادم…',
    offline: 'تعذّر الوصول للخادم',
    'no-server': 'لم يُضبط خادم للغرف',
  }[room.status];
  const save = () => { const u = setServerUrl(url); setUrl(u); room.changeServer(u); setOpen(false); };
  // how long we have been trying — a free server needs up to a minute to wake up
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (room.status === 'online' || room.status === 'no-server') return undefined;
    const t0 = Date.now();
    const id = setInterval(() => setWaited(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => { clearInterval(id); setWaited(0); };
  }, [room.status]);
  return (
    <div className="rk-server">
      <div className="rk-server-row">
        <span className={`rk-dot ${room.status}`} />
        <span className="rk-server-label">{label}</span>
        <button className="rk-link" onClick={() => setOpen(o => !o)}>{open ? 'إغلاق' : 'عنوان الخادم'}</button>
      </div>
      {(room.status === 'offline' || room.status === 'connecting') && !open && (
        <div className="rk-wake">
          <p className="rk-hint">
            {waited < 5
              ? 'نتصل بالخادم…'
              : 'الخادم المجاني ينام إذا ما أحد استخدمه، وأول مرة يحتاج حتى دقيقة ليصحى. ننتظر ونعيد المحاولة تلقائياً — لا تغلق الصفحة.'}
            {waited >= 5 && <b className="rk-wait-sec"> ({waited} ثانية)</b>}
          </p>
          <button className="rk-btn small ghost" onClick={room.reconnect}>حاول الآن</button>
        </div>
      )}
      {open && (
        <div className="rk-server-edit">
          <p className="rk-hint">الغرف الأونلاين تحتاج خادم اللعبة. الصق عنوانه (مثل <b dir="ltr">gathering-games.onrender.com</b>).</p>
          <div className="rk-row">
            <input className="rk-input" dir="ltr" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
            <button className="rk-btn small" onClick={save}>حفظ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create / join ─────────────────────────────────────────────────────────────
export function RoomEntry({ room, logo, teams, defaultTeam, createOptions, onExit }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(inviteCode);
  const [team, setTeam] = useState(defaultTeam ?? null);
  const [busy, setBusy] = useState(false);
  const ready = room.status === 'online';
  const run = async fn => { setBusy(true); saveName(name.trim()); await fn(); setBusy(false); };
  const extra = teams ? { team } : {};
  const createIt = () => run(() => room.create(name.trim(), { ...extra, options: createOptions }));
  // why are the buttons greyed out? Say it instead of leaving the user guessing.
  const why = !ready ? 'ننتظر اتصال الخادم قبل أن تعمل الأزرار.' : !name.trim() ? 'اكتب اسمك أولاً لتفعيل الأزرار.' : '';
  return (
    <div className="rk-card pop-in">
      {logo}
      <ServerStatus room={room} />
      <label className="rk-label">اسمك</label>
      <input className="rk-input" placeholder="اكتب اسمك" value={name} maxLength={20}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && ready && name.trim() && !busy) { if (code.length >= 4) run(() => room.join(code, name.trim(), extra)); else createIt(); } }} />
      {teams && (
        <>
          <label className="rk-label">فريقك</label>
          <div className="rk-teams">
            {teams.map(t => (
              <button key={t.value} className={`rk-team ${team === t.value ? 'on' : ''}`} style={{ '--tc': t.color }}
                onClick={() => setTeam(t.value)}>{t.label}</button>
            ))}
          </div>
        </>
      )}
      {room.error && <div className="rk-error shake">{room.error}</div>}
      {room.notice && <div className="rk-notice">{room.notice}</div>}
      {!code && (
        <>
          <button className="rk-btn" disabled={!ready || busy || !name.trim()} onClick={createIt}>
            إنشاء غرفة جديدة
          </button>
          {why && <p className="rk-why">{why}</p>}
          <button className="rk-tv-btn" disabled={!ready || busy}
            onClick={() => run(() => room.create('', { display: true, options: createOptions }))}>
            <span className="rk-tv-icon" aria-hidden="true" />
            <span><b>افتح هذا الجهاز كشاشة عرض</b><small>للتلفزيون أو اللابتوب: يعرض الأسئلة والنقاط، والكل يلعب من جواله</small></span>
          </button>
        </>
      )}
      {code && why && <p className="rk-why">{why}</p>}
      <div className="rk-or"><span>{code ? 'الانضمام للغرفة' : 'أو انضم برمز'}</span></div>
      <div className="rk-row">
        <input className="rk-input rk-code-input" dir="ltr" placeholder="رمز الغرفة" value={code} maxLength={6}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <button className={`rk-btn ${code ? '' : 'ghost'}`} disabled={!ready || busy || !name.trim() || code.length < 4}
          onClick={() => run(() => room.join(code, name.trim(), extra))}>انضم</button>
      </div>
      {onExit && <button className="rk-link center" onClick={onExit}>← العودة</button>}
    </div>
  );
}

// ── Lobby pieces ──────────────────────────────────────────────────────────────
/** QR code drawn as SVG (synchronous — no canvas, no network). */
export function QRCode({ value, size = 180 }) {
  const path = useMemo(() => {
    const { modules } = QR.create(value, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    return { d, n };
  }, [value]);
  return (
    <svg className="rk-qr" width={size} height={size} viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} role="img" aria-label="رمز QR للانضمام">
      <rect x="-2" y="-2" width={path.n + 4} height={path.n + 4} fill="#fff" />
      <path d={path.d} fill="#18181b" shapeRendering="crispEdges" />
    </svg>
  );
}

export function RoomCode({ code, big }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const link = inviteLink(code);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'انضم للعبة', text: `رمز الغرفة: ${code}`, url: link });
      else { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };
  if (big) {
    return (
      <div className="rk-code big">
        <QRCode value={link} size={220} />
        <div className="rk-code-text">
          <span className="rk-code-label">امسح الرمز بكاميرا الجوال للانضمام</span>
          <span className="rk-code-label">أو ادخل الموقع واكتب رمز الغرفة</span>
          <strong className="rk-code-value" dir="ltr">{code}</strong>
        </div>
      </div>
    );
  }
  return (
    <div className="rk-code">
      <span className="rk-code-label">رمز الغرفة</span>
      <strong className="rk-code-value" dir="ltr">{code}</strong>
      {showQr && <QRCode value={link} size={170} />}
      <div className="rk-row">
        <button className="rk-btn small ghost" onClick={share}>{copied ? 'تم نسخ الرابط ✓' : 'شارك رابط الدعوة'}</button>
        <button className="rk-btn small ghost" onClick={() => setShowQr(q => !q)}>{showQr ? 'إخفاء QR' : 'رمز QR'}</button>
      </div>
    </div>
  );
}

/** Host setting for team games: who may answer for a team. */
export function AnswerBySetting({ state, room }) {
  return (
    <div className="rk-setting">
      <div>
        <b>من يجاوب عن الفريق؟</b>
        <small>{state.answerBy === 'captain' ? 'القائد فقط يختار ويجاوب — المضيف يغيّر القائد من قائمة اللاعبين.' : 'أي عضو في الفريق — أول ضغطة تُحسب.'}</small>
      </div>
      <div className="rk-seg">
        <button className={state.answerBy !== 'captain' ? 'on' : ''} disabled={!state.isHost} onClick={() => room.act('settings', { answerBy: 'any' })}>أي عضو</button>
        <button className={state.answerBy === 'captain' ? 'on' : ''} disabled={!state.isHost} onClick={() => room.act('settings', { answerBy: 'captain' })}>القائد فقط</button>
      </div>
    </div>
  );
}

export function PlayerList({ state, room, teams, onTeam }) {
  const playing = state.players.filter(p => p.role !== 'display');
  const screen = state.players.find(p => p.role === 'display');
  const captainMode = state.answerBy === 'captain';
  const groups = teams
    ? teams.map(t => ({ ...t, players: playing.filter(p => p.team === t.value) }))
    : [{ value: null, label: `اللاعبون (${playing.length})`, players: playing }];
  return (
    <>
    {screen && <div className={`rk-screen-line ${screen.connected ? '' : 'away'}`}>شاشة العرض {screen.connected ? 'متصلة' : 'غير متصلة'}{screen.id === state.hostId ? ' — وهي المضيف' : ''}</div>}
    <div className={`rk-groups ${teams ? 'teams' : ''}`}>
      {groups.map(g => (
        <div key={String(g.value)} className="rk-group" style={g.color ? { '--tc': g.color } : {}}>
          <div className="rk-group-head">
            <span>{g.label}{teams ? ` (${g.players.length})` : ''}</span>
            {teams && onTeam && room.me && room.me.role !== 'display' && room.me.team !== g.value && (
              <button className="rk-link" onClick={() => onTeam(g.value)}>انتقل هنا</button>
            )}
          </div>
          {g.players.map(p => (
            <div key={p.id} className={`rk-player ${p.connected ? '' : 'away'}`}>
              <span className="rk-avatar">{p.name.slice(0, 1)}</span>
              <span className="rk-pname">{p.name}</span>
              {captainMode && state.captains?.[p.team] === p.id && <span className="rk-tag captain">القائد</span>}
              {p.id === state.hostId && <span className="rk-tag">المضيف</span>}
              {p.id === state.youId && <span className="rk-tag you">أنت</span>}
              {!p.connected && <span className="rk-tag away">غير متصل</span>}
              {state.isHost && captainMode && teams && state.captains?.[p.team] !== p.id && (
                <button className="rk-link small" onClick={() => room.act('captain', { playerId: p.id })}>اجعله القائد</button>
              )}
              {state.isHost && p.id !== state.youId && (
                <button className="rk-kick" title="إخراج" onClick={() => room.act('kick', { playerId: p.id })}>✕</button>
              )}
            </div>
          ))}
          {!g.players.length && <div className="rk-empty">لا أحد بعد</div>}
        </div>
      ))}
    </div>
    </>
  );
}

/** Shown on top of any in-room screen while the connection is down. */
export function ConnectionBanner({ room }) {
  if (!room.state || room.status === 'online') return null;
  return <div className="rk-banner">انقطع الاتصال — نحاول إعادة الربط…</div>;
}

export function RoomError({ room }) {
  if (!room.state || !room.error) return null;
  return <div className="rk-toast pop-in">{room.error}</div>;
}


