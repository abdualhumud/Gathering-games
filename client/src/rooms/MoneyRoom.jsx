import { useState } from 'react';
import Timer from '../components/Timer';
import {
  MoneyBoardHeader, MoneyScores, BoardGrid, ResultFlash, ModeratorPanel, GameOverScreen,
  SUPER_POWERS, OPT_KEYS,
} from '../pages/MoneyBoardPage';
import { useRoom } from './useRoom';
import { useCue } from '../sound';
import {
  RoomEntry, RoomCode, PlayerList, ConnectionBanner, RoomError, AnswerBySetting,
} from './RoomKit';
import { timerProps, timerKey, isDisplay, canAnswerFor } from './roomUtils';

const TEAM_OPTS = [
  { value: 'A', label: 'الفريق الأول', color: '#5b9aff' },
  { value: 'B', label: 'الفريق الثاني', color: '#f97316' },
];

function Marquee() {
  return (
    <div className="mb-marquee">
      <span className="mb-marquee-kicker">غرفة أونلاين</span>
      <h1 className="mb-logo">لوحة <span>المال</span></h1>
    </div>
  );
}

export default function MoneyRoom({ onExit }) {
  const room = useRoom('money');
  const s = room.state;
  const [modOpen, setModOpen] = useState(false);
  // the option I tapped — reset whenever the cell / phase / attempt changes
  const [pick, setPick] = useState(null);
  const cellKey = s?.cell ? `${s.cell.col}-${s.cell.row}-${s.phase}-${s.wrongOpts.length}-${s.timer?.key}` : '';
  const picked = pick && pick.key === cellKey ? pick.i : null;
  const setPicked = i => setPick({ key: cellKey, i });
  const cellId = s?.cell ? `${s.cell.col}-${s.cell.row}` : '';
  useCue(s?.phase === 'result' && s.result ? `r${cellId}` : null, s?.result?.winner ? 'correct' : 'wrong');
  useCue(s?.phase === 'steal' ? `s${cellId}` : null, 'wrong');
  useCue(s?.phase === 'over' ? 'over' : null, 'win');

  if (!s) {
    return (
      <div className="page mb-setup rk-theme-money">
        <RoomEntry room={room} logo={<Marquee />} teams={TEAM_OPTS} defaultTeam="A" onExit={onExit} />
      </div>
    );
  }

  const myTeam = room.me?.team;
  const tv = isDisplay(room.me);
  const tvCls = tv ? ' is-tv' : '';
  const mayAct = canAnswerFor(s, room.me);   // captain-only mode limits picking/answering
  const names = s.teamNames;
  const teams = { A: { ...s.teams.A, name: names.A }, B: { ...s.teams.B, name: names.B } };
  const leave = async () => { await room.leave(); onExit(); };
  const teamOpts = TEAM_OPTS.map(t => ({ ...t, label: names[t.value] }));

  if (s.phase === 'lobby') {
    const cats = Object.entries(s.allCategories).sort((a, b) => b[1] - a[1]);
    const toggle = c => {
      const next = s.categories.includes(c) ? s.categories.filter(x => x !== c) : [...s.categories, c].slice(0, 6);
      room.act('settings', { categories: next });
    };
    const ready = TEAM_OPTS.every(t => s.players.some(p => p.team === t.value && p.connected && p.role !== 'display'));
    return (
      <div className={`page mb-setup rk-theme-money${tvCls}`}>
        <ConnectionBanner room={room} />
        <div className="mb-stage-card mb-setup-card rk-lobby">
          <Marquee />
          <RoomCode code={s.code} big={tv} />
          <AnswerBySetting state={s} room={room} />
          <PlayerList state={s} room={room} teams={teamOpts} onTeam={team => room.act('team', { team })} />
          <div className="cat-select-section">
            <div className="cat-select-head">
              <h3>الفئات <span className="cat-count">{s.categories.length}/6</span></h3>
              {s.isHost && (
                <div className="cat-quick-btns">
                  <button className="cat-quick-btn" onClick={() => room.act('settings', { random: true })}>🎲 عشوائي</button>
                  {s.categories.length > 0 && <button className="cat-quick-btn" onClick={() => room.act('settings', { categories: [] })}>✕ مسح</button>}
                </div>
              )}
            </div>
            {s.isHost ? (
              <div className="cat-grid">
                {cats.map(([c, n]) => (
                  <button key={c} className={`cat-chip ${s.categories.includes(c) ? 'selected' : ''}`}
                    disabled={!s.categories.includes(c) && s.categories.length >= 6} onClick={() => toggle(c)}>
                    <span className="cat-name">{c}</span>
                    <span className="cat-q-badge">{n} سؤال</span>
                    {s.categories.includes(c) && <span className="cat-num">{s.categories.indexOf(c) + 1}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-slots">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <span key={i} className={`mb-slot ${s.categories[i] ? 'filled' : ''}`}>{s.categories[i] || i + 1}</span>
                ))}
              </div>
            )}
          </div>
          {room.error && <div className="rk-error">{room.error}</div>}
          {s.isHost ? (
            <button className="mb-start-btn" disabled={s.categories.length !== 6 || !ready} onClick={() => room.act('start')}>
              {!ready ? 'يحتاج كل فريق لاعباً واحداً على الأقل' : s.categories.length !== 6 ? `اختر ${6 - s.categories.length} فئات أخرى` : 'ابدأ اللعبة'}
            </button>
          ) : <p className="rk-wait">المضيف يختار الفئات… ثم يبدأ اللعبة</p>}
          <button className="rk-link center" onClick={leave}>مغادرة الغرفة</button>
        </div>
      </div>
    );
  }

  if (s.phase === 'over') {
    const aM = s.teams.A.money, bM = s.teams.B.money;
    const winner = aM > bM ? 'A' : bM > aM ? 'B' : null;
    return (
      <div className="rk-theme-money">
        <GameOverScreen teams={teams} winner={winner} isTie={winner === null} myTeam={myTeam} stats={s.stats}
          onReset={s.isHost ? () => room.act('restart') : null} onHome={leave} />
      </div>
    );
  }

  const modPanel = s.isHost && (
    <>
      <button className="mod-panel-btn" onClick={() => setModOpen(true)} title="لوحة المضيف">⚙️</button>
      {modOpen && <ModeratorPanel teams={teams} onAdjust={(team, amount) => room.act('adjust', { team, amount })} onClose={() => setModOpen(false)} />}
    </>
  );

  if (s.phase === 'pick') {
    const myTurn = myTeam === s.currentTurn && mayAct;
    return (
      <div className={`mb-game-page rk-theme-money${tvCls}`}>
        {tv && <span className="rk-tv-badge">شاشة العرض · {s.code}</span>}
        <ConnectionBanner room={room} />
        <RoomError room={room} />
        <MoneyBoardHeader teams={teams} currentTurn={s.currentTurn} phase={myTurn ? 'pick' : 'wait'} myTeam={myTeam} />
        {myTeam === s.currentTurn && !mayAct && <p className="rk-captain-note">قائد فريقك هو من يختار السؤال</p>}
        <BoardGrid board={s.board} activeCell={null} canPick={myTurn} currentTurn={s.currentTurn}
          onPickCell={(col, row) => room.act('pick', { col, row })} />
        {modPanel}
      </div>
    );
  }

  // question / steal / result
  const isSteal = s.phase === 'steal';
  const resolved = s.phase === 'result';
  const q = s.question;
  const active = s.activeTeam;
  const canAnswer = !resolved && myTeam === active && mayAct;
  const myPowers = s.teams[myTeam]?.powers || [];
  const category = s.board?.[s.cell?.col]?.category;
  const tp = timerProps(s.timer);
  const r = s.result;
  const info = r && {
    isCorrect: !!r.winner, winner: r.winner, points: r.points,
    hafra: r.hafraPoints > 0, hafraPoints: r.hafraPoints, correctAnswer: r.correctAnswer,
  };

  return (
    <div className={`mb-question-page rk-theme-money${tvCls}`}>
      {tv && <span className="rk-tv-badge">شاشة العرض · {s.code}</span>}
      <ConnectionBanner room={room} />
      <RoomError room={room} />
      <div className="q-page-header">
        <MoneyScores teams={teams} currentTurn={active} myTeam={myTeam} />
        <div className={`points-badge ${isSteal ? 'steal-badge' : ''}`}>
          {isSteal ? `سرقة — ${names[active]}` : <>{s.points}<small>ريال</small></>}
        </div>
        <Timer key={timerKey(s.timer)} {...tp} />
      </div>

      {isSteal && <div className="steal-banner pop-in">فرصة السرقة — {names[active]}</div>}

      {(s.effects.double || s.effects.two || s.effects.hafra) && (
        <div className="active-powers-bar pop-in">
          {s.effects.double && <span className="active-power-tag double-tag">2x مضاعفة النقاط</span>}
          {s.effects.two && <span className="active-power-tag two-tag">✌️ إجابتين</span>}
          {s.effects.hafra && <span className="active-power-tag hafra-tag">🔄 الحفرة مفعّلة</span>}
        </div>
      )}

      {s.phase === 'question' && myTeam === active && mayAct && (
        <div className="super-powers-bar">
          <span className="sp-label">قوى {names[myTeam]}:</span>
          {SUPER_POWERS.map(sp => {
            const available = myPowers.includes(sp.id);
            const on = !!s.effects[sp.id];
            return (
              <button key={sp.id} className={`sp-btn sp-${sp.id} ${!available ? 'sp-used' : ''} ${on ? 'sp-active' : ''}`}
                title={`${sp.name} — ${sp.desc}`} disabled={!available || on || picked !== null}
                onClick={() => room.act('power', { power: sp.id })}>
                <span className="sp-icon">{sp.icon}</span>
                <span className="sp-name">{sp.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {s.friend > 0 && <div className="friend-timer-banner pop-in">📞 اتصل بصديق — {s.friend} ثانية</div>}
      {s.lastPower?.blocked && s.phase === 'question' && (
        <div className="active-powers-bar"><span className="active-power-tag hafra-tag">🚫 {names[s.lastPower.team]} حجب «{SUPER_POWERS.find(p => p.id === s.lastPower.blocked)?.name}» من الخصم</span></div>
      )}

      <div className="question-card card pop-in" key={q?.id}>
        {category && <p className="question-category-tag">{category} · <b>{s.points} ريال</b></p>}
        <p className="question-text">{q?.text}</p>
      </div>

      <div className="options-grid">
        {q?.options.map((opt, i) => {
          const tried = s.wrongOpts.includes(i);
          const isRight = resolved && opt === r?.correctAnswer;
          const cls = resolved
            ? (isRight ? 'opt-correct' : (tried || r?.selected === i) ? 'opt-wrong' : 'opt-dim')
            : tried ? 'opt-wrong opt-eliminated' : picked === i ? 'answered' : '';
          return (
            <button key={i} className={`option-btn ${cls}`} disabled={!canAnswer || tried || picked !== null}
              onClick={() => { setPicked(i); room.act('answer', { index: i }); }}>
              <span className="opt-key">{OPT_KEYS[i]}</span>
              <span className="opt-text">{opt}</span>
            </button>
          );
        })}
      </div>

      {!resolved && !canAnswer && <p className="rk-wait">{myTeam === active && !mayAct ? 'قائد فريقك هو من يجاوب — تشاوروا!' : `ينتظر إجابة ${names[active]}…`}</p>}
      {s.isHost && !resolved && (
        <button className="rk-link center" onClick={() => room.act('skip')}>تخطّي السؤال (المضيف)</button>
      )}
      {info && <ResultFlash info={info} teamNames={names} />}
      {modPanel}
    </div>
  );
}
