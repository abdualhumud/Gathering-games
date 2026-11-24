import { useState } from 'react';
import Timer from '../components/Timer';
import { HexGrid, ScoreBar, rgba, PATH_GOAL } from '../pages/HuroofPage';
import { useRoom } from './useRoom';
import { useCue } from '../sound';
import { RoomEntry, RoomCode, PlayerList, ConnectionBanner, RoomError, AnswerBySetting } from './RoomKit';
import { timerProps, timerKey, isDisplay, canAnswerFor } from './roomUtils';

const TEAM_OPTS = [
  { value: 0, label: 'الفريق الأخضر', color: '#22c55e' },
  { value: 1, label: 'الفريق البرتقالي', color: '#f97316' },
];

function Logo() {
  return (
    <div className="huroof-room-logo">
      <span className="huroof-room-hex">⬡</span>
      <h1>لعبة الحروف</h1>
      <span className="huroof-room-kicker">غرفة أونلاين — فريقان</span>
    </div>
  );
}

export default function HuroofRoom({ onExit }) {
  const room = useRoom('huroof');
  const s = room.state;
  const [pick, setPick] = useState(null);
  const pickKey = `${s?.question?.id}-${s?.answering}-${s?.isSteal}`;
  const picked = pick && pick.key === pickKey ? pick.i : null;
  useCue(s?.phase === 'answering' && !s.isSteal ? `${s.question?.id}-${s.answering}` : null, 'buzz');
  useCue(s?.phase === 'result' && s.result && !s.result.noBuzz && !s.result.timeout ? `${s.question?.id}-${s.answering}-r` : null, s?.result?.correct ? 'correct' : 'wrong');
  useCue(s?.phase === 'over' ? 'over' : null, 'win');

  if (!s) {
    return (
      <div className="page huroof-setup rk-theme-huroof">
        <RoomEntry room={room} logo={<Logo />} teams={TEAM_OPTS} defaultTeam={0} onExit={onExit} />
      </div>
    );
  }

  const myTeam = room.me?.team;
  const tv = isDisplay(room.me);
  const tvCls = tv ? ' is-tv' : '';
  const mayAct = canAnswerFor(s, room.me);
  const teams = s.teams;
  const pathMode = s.winMode === 'path';
  const leave = async () => { await room.leave(); onExit(); };

  if (s.phase === 'lobby') {
    const ready = [0, 1].every(t => s.players.some(p => p.team === t && p.connected && p.role !== 'display'));
    return (
      <div className={`page huroof-setup rk-theme-huroof${tvCls}`}>
        <ConnectionBanner room={room} />
        <div className="setup-card card rk-lobby">
          <Logo />
          <RoomCode code={s.code} big={tv} />
          <AnswerBySetting state={s} room={room} />
          <PlayerList state={s} room={room} teams={TEAM_OPTS.map((t, i) => ({ ...t, label: `${t.label} · ${pathMode ? PATH_GOAL[i].split(' ')[0] : ''}` }))}
            onTeam={team => room.act('team', { team })} />
          <div className="grid-size-select">
            <label>طريقة الفوز:</label>
            <div className="size-btns">
              <button className={`size-btn ${pathMode ? 'selected' : ''}`} disabled={!s.isHost}
                onClick={() => room.act('settings', { winMode: 'path' })}>🛤 توصيل مسار</button>
              <button className={`size-btn ${!pathMode ? 'selected' : ''}`} disabled={!s.isHost}
                onClick={() => room.act('settings', { winMode: 'majority' })}>🔢 أكثر خلايا</button>
            </div>
          </div>
          <p className="win-mode-hint">
            {pathMode ? 'الأخضر يوصل اليمين باليسار، والبرتقالي يوصل الأعلى بالأسفل.' : 'عند امتلاء الشبكة يفوز صاحب أكثر خلايا.'}
          </p>
          {room.error && <div className="rk-error">{room.error}</div>}
          {s.isHost
            ? <button className="btn-green start-game-btn" disabled={!ready} onClick={() => room.act('start')}>
                {ready ? 'ابدأ اللعبة ⬡' : 'يحتاج كل فريق لاعباً واحداً على الأقل'}
              </button>
            : <p className="rk-wait">بانتظار المضيف ليبدأ…</p>}
          <button className="rk-link center" onClick={leave}>مغادرة الغرفة</button>
        </div>
      </div>
    );
  }

  if (s.phase === 'over') {
    const w = s.winInfo;
    const winner = teams[w?.team];
    const title = w?.tie ? 'تعادل!' : w?.path ? `فاز ${winner?.name} بتوصيل المسار!` : `فاز ${winner?.name}!`;
    return (
      <div className="page asbiq-gameover huroof-over rk-theme-huroof">
        <ConnectionBanner room={room} />
        <div className="gameover-hero pop-in">
          <div className="gameover-trophy">{w?.team === myTeam && !w?.tie ? '🏆' : '⬡'}</div>
          <h1 className="winner-text" style={{ color: w?.tie ? 'var(--gold)' : winner?.color }}>{title}</h1>
        </div>
        <div className="final-grid-wrap">
          <HexGrid grid={s.grid} teams={teams} activeIdx={-1} selectableIdxs={[]} onSelect={() => {}}
            phase="over" pathMode={pathMode} winPath={w?.path} />
        </div>
        <ScoreBar teams={teams} counts={s.counts} controlIdx={null} pathMode={pathMode} />
        <div className="gameover-actions">
          {s.isHost && <button className="btn-green" onClick={() => room.act('restart')}>جولة جديدة</button>}
          <button className="btn-secondary" onClick={leave}>مغادرة</button>
        </div>
      </div>
    );
  }

  const letter = s.grid[s.activeIdx]?.letter;
  const ctrl = s.control !== null ? teams[s.control] : null;
  const ans = s.answering !== null ? teams[s.answering] : null;
  const canSelect = s.phase === 'select' && (s.isHost || ((s.control === null || s.control === myTeam) && mayAct));
  const label = {
    pre: `استعدوا… حرف «${letter ?? ''}»`,
    buzzing: 'اضغط الجرس!',
    answering: ans ? (s.isSteal ? `سرقة — ${ans.name}` : `${ans.name} يجيب`) : '',
    result: 'النتيجة',
    select: ctrl ? `${ctrl.name} يختار الحرف التالي` : 'اختاروا الحرف التالي',
  }[s.phase] || '';
  const q = s.question;
  const tp = timerProps(s.timer);
  const r = s.result;
  const myColor = teams[myTeam]?.color;

  return (
    <div className={`huroof-game-page rk-theme-huroof${tvCls}`}>
      {tv && <span className="rk-tv-badge">شاشة العرض · {s.code}</span>}
      <ConnectionBanner room={room} />
      <RoomError room={room} />
      <div className="huroof-header">
        <button className="back-btn-inline" onClick={leave}>← مغادرة</button>
        <div className="huroof-phase-label">{label}</div>
        {myTeam !== undefined && myTeam !== null && (
          <span className="huroof-my-team" style={{ color: myColor, borderColor: rgba(myColor, 0.5) }}>أنت: {teams[myTeam].name}</span>
        )}
      </div>

      <ScoreBar teams={teams} counts={s.counts} controlIdx={s.control} pathMode={pathMode} />

      {s.phase === 'select' && (
        <div className="path-select-hint" style={ctrl ? { borderColor: rgba(ctrl.color, 0.5), color: ctrl.color, background: rgba(ctrl.color, 0.08) } : {}}>
          {canSelect ? '🗺 دوركم — اضغط على أي حرف لم يُؤخذ بعد' : `🗺 ${ctrl?.name ?? 'الفريق'} يختار الحرف التالي…`}
        </div>
      )}

      {r && s.phase === 'result' && (
        <div className={`result-flash ${r.correct ? 'flash-correct' : 'flash-wrong'} pop-in`}>
          {r.correct ? `✅ ${teams[r.team]?.name} — إجابة صحيحة!`
            : r.noBuzz ? `⏱ لم يضغط أحد — الإجابة: ${r.answer}`
              : r.timeout ? `⏰ انتهى الوقت — الصواب: ${r.answer}`
                : `❌ خطأ — الصواب: ${r.answer}`}
        </div>
      )}

      <HexGrid grid={s.grid} teams={teams} activeIdx={s.activeIdx}
        selectableIdxs={canSelect ? s.grid.filter(h => h.owner === null).map(h => h.index) : []}
        onSelect={index => room.act('select', { index })}
        phase={canSelect ? 'path-select' : s.phase} pathMode={pathMode} />

      {s.phase === 'buzzing' && q && (
        <div className="buzzer-overlay">
          <div className="buzzer-card">
            <div className="letter-badge" style={{ background: 'var(--huroof-accent)' }}>{letter}</div>
            <div className="buzzer-badge">⚡ اضغط الجرس أولاً!</div>
            {q.category && <div className="q-category">{q.category}</div>}
            <p className="q-text">{q.text}</p>
            <Timer key={timerKey(s.timer)} {...tp} />
            <div className="buzzer-team-grid">
              {tv ? <p className="huroof-tv-wait">اضغطوا الجرس من جوالاتكم!</p> : (
              <button className="buzzer-btn huroof-room-buzz"
                style={{ '--bt': myColor, '--bt-dim': rgba(myColor, 0.2), '--bt-glow': rgba(myColor, 0.45) }}
                onClick={() => { navigator.vibrate?.(40); room.act('buzz'); }}>
                🔔 {teams[myTeam]?.name}
              </button>
              )}
            </div>
            {s.isHost && <button className="skip-q-btn" onClick={() => room.act('skip')}>🔄 سؤال آخر لنفس الحرف</button>}
          </div>
        </div>
      )}

      {(s.phase === 'answering' || (s.phase === 'result' && q && s.answering !== null && !r?.noBuzz)) && q && ans && (
        <div className="buzzer-overlay">
          <div className="buzzer-card">
            {s.isSteal && <div className="steal-pill">⚡ فرصة السرقة</div>}
            <div className="buzzer-badge" style={{ color: ans.color }}>
              {ans.name}{s.buzzedBy && !s.isSteal ? ` — ضغط ${s.buzzedBy}` : ''}
            </div>
            <div className="letter-badge" style={{ background: ans.color }}>{letter}</div>
            <div className="q-hint">الإجابة تبدأ بحرف «{letter}»</div>
            <p className="q-text">{q.text}</p>
            {s.phase === 'answering' && <Timer key={timerKey(s.timer)} {...tp} />}
            <div className="opts-grid">
              {q.options.map((opt, i) => {
                const revealed = s.phase === 'result';
                const cls = !revealed ? (picked === i ? 'opt-picked' : '')
                  : opt === q.answer ? 'opt-correct' : s.selected === i ? 'opt-wrong' : 'opt-dim';
                const mine = s.answering === myTeam && s.phase === 'answering' && mayAct;
                return (
                  <button key={i} className={`opt-btn ${cls}`} disabled={!mine || picked !== null}
                    onClick={() => { setPick({ key: pickKey, i }); room.act('answer', { index: i }); }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {s.phase === 'answering' && s.answering !== myTeam && <p className="rk-wait">ينتظر إجابة {ans.name}…</p>}
            {s.phase === 'answering' && s.answering === myTeam && !mayAct && <p className="rk-wait">قائد فريقك هو من يجاوب — تشاوروا!</p>}
          </div>
        </div>
      )}
    </div>
  );
}
