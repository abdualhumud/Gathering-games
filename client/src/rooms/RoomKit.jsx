import { useState } from 'react';
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
  return (
    <div className="rk-server">
      <div className="rk-server-row">
        <span className={`rk-dot ${room.status}`} />
        <span className="rk-server-label">{label}</span>
        <button className="rk-link" onClick={() => setOpen(o => !o)}>{open ? 'إغلاق' : 'عنوان الخادم'}</button>
      </div>
      {room.status === 'offline' && !open && (
        <p className="rk-hint">إذا كان الخادم مجانياً قد يحتاج دقيقة ليستيقظ. تأكد من العنوان أو جرّب لاحقاً.</p>
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
  return (
    <div className="rk-card pop-in">
      {logo}
      <ServerStatus room={room} />
      <label className="rk-label">اسمك</label>
      <input className="rk-input" placeholder="اكتب اسمك" value={name} maxLength={20}
        onChange={e => setName(e.target.value)} />
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
        <button className="rk-btn" disabled={!ready || busy || !name.trim()}
          onClick={() => run(() => room.create(name.trim(), { ...extra, options: createOptions }))}>
          إنشاء غرفة جديدة
        </button>
      )}
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
export function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(code);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'انضم للعبة', text: `رمز الغرفة: ${code}`, url: link });
      else { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };
  return (
    <div className="rk-code">
      <span className="rk-code-label">رمز الغرفة</span>
      <strong className="rk-code-value" dir="ltr">{code}</strong>
      <button className="rk-btn small ghost" onClick={share}>{copied ? 'تم نسخ الرابط ✓' : 'شارك رابط الدعوة'}</button>
    </div>
  );
}

export function PlayerList({ state, room, teams, onTeam }) {
  const groups = teams
    ? teams.map(t => ({ ...t, players: state.players.filter(p => p.team === t.value) }))
    : [{ value: null, label: `اللاعبون (${state.players.length})`, players: state.players }];
  return (
    <div className={`rk-groups ${teams ? 'teams' : ''}`}>
      {groups.map(g => (
        <div key={String(g.value)} className="rk-group" style={g.color ? { '--tc': g.color } : {}}>
          <div className="rk-group-head">
            <span>{g.label}{teams ? ` (${g.players.length})` : ''}</span>
            {teams && onTeam && room.me && room.me.team !== g.value && (
              <button className="rk-link" onClick={() => onTeam(g.value)}>انتقل هنا</button>
            )}
          </div>
          {g.players.map(p => (
            <div key={p.id} className={`rk-player ${p.connected ? '' : 'away'}`}>
              <span className="rk-avatar">{p.name.slice(0, 1)}</span>
              <span className="rk-pname">{p.name}</span>
              {p.id === state.hostId && <span className="rk-tag">المضيف</span>}
              {p.id === state.youId && <span className="rk-tag you">أنت</span>}
              {!p.connected && <span className="rk-tag away">غير متصل</span>}
              {state.isHost && p.id !== state.youId && (
                <button className="rk-kick" title="إخراج" onClick={() => room.act('kick', { playerId: p.id })}>✕</button>
              )}
            </div>
          ))}
          {!g.players.length && <div className="rk-empty">لا أحد بعد</div>}
        </div>
      ))}
    </div>
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


