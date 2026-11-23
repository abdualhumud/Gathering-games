import { useEffect, useState } from 'react';
import Timer from '../components/Timer';
import {
  AsbiqLogo, AsbiqHud, AsbiqStrip, AsbiqVerdict, AsbiqPodium, OPT_KEYS, pcStyle,
} from '../pages/AsbiqhumPage';
import { useRoom } from './useRoom';
import {
  RoomEntry, RoomCode, PlayerList, ConnectionBanner, RoomError,
} from './RoomKit';
import { timerProps, timerKey } from './roomUtils';

const COUNTS = [5, 10, 15, 20];

export default function AsbiqhumRoom({ onExit }) {
  const room = useRoom('asbiqhum');
  const s = room.state;
  // the option I tapped — only valid for the question/phase it was tapped in
  const [pick, setPick] = useState(null);
  const pickKey = `${s?.question?.id}-${s?.phase}`;
  const picked = pick && pick.key === pickKey ? pick.i : null;
  const setPicked = i => setPick({ key: pickKey, i });

  // Space bar buzzes (handy on laptops)
  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Space' && room.state?.phase === 'question') { e.preventDefault(); room.act('buzz'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [room]);

  if (!s) {
    return (
      <div className="asb asb-center rk-theme-asbiq">
        <RoomEntry room={room} logo={<AsbiqLogo small />} onExit={onExit} />
      </div>
    );
  }

  const players = s.players.map((p, i) => ({ ...p, score: s.scores[p.id] || 0, color: i }));
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const leave = async () => { await room.leave(); onExit(); };

  if (s.phase === 'lobby') {
    return (
      <div className="asb asb-center rk-theme-asbiq">
        <ConnectionBanner room={room} />
        <div className="asbiq-panel rk-lobby">
          <AsbiqLogo small />
          <RoomCode code={s.code} />
          {s.isHost && (
            <div className="asbiq-section-head">
              <h3>عدد الأسئلة</h3>
              <div className="asbiq-seg">
                {COUNTS.map(n => (
                  <button key={n} className={s.total === n ? 'on' : ''} onClick={() => room.act('settings', { questions: n })}>{n}</button>
                ))}
              </div>
            </div>
          )}
          <PlayerList state={s} room={room} />
          {room.error && <div className="rk-error">{room.error}</div>}
          {s.isHost
            ? <button className="asbiq-go" disabled={players.filter(p => p.connected).length < 2} onClick={() => room.act('start')}>
                {players.filter(p => p.connected).length < 2 ? 'بانتظار لاعب آخر على الأقل…' : `ابدأ (${s.total} أسئلة)`}
              </button>
            : <p className="rk-wait">بانتظار المضيف ليبدأ اللعبة…</p>}
          <button className="rk-link center" onClick={leave}>مغادرة الغرفة</button>
        </div>
      </div>
    );
  }

  if (s.phase === 'over') {
    return (
      <div className="asb asb-play asb-over rk-theme-asbiq">
        <ConnectionBanner room={room} />
        <AsbiqPodium players={players} />
        <div className="asbiq-actions">
          <button className="asbiq-ghost" onClick={leave}>مغادرة</button>
          {s.isHost
            ? <button className="asbiq-go" onClick={() => room.act('restart')}>جولة جديدة</button>
            : <p className="rk-wait" style={{ flex: 1 }}>بانتظار المضيف…</p>}
        </div>
      </div>
    );
  }

  // question / buzzed / result
  const q = s.question;
  const meLocked = s.locked.includes(s.youId);
  const buzzer = byId[s.buzzerId];
  const iAnswer = s.phase === 'buzzed' && s.buzzerId === s.youId;
  const tp = timerProps(s.timer);
  const r = s.result;
  const who = r && byId[r.playerId]?.name;

  return (
    <div className="asb asb-play rk-theme-asbiq">
      <ConnectionBanner room={room} />
      <RoomError room={room} />
      <AsbiqHud index={s.qIndex} total={s.total} category={q?.category}>
        <Timer key={timerKey(s.timer)} {...tp} />
      </AsbiqHud>

      <div className="asbiq-qcard pop-in" key={q?.id}>
        <p className="question-text">{q?.text}</p>
      </div>

      {s.phase === 'question' && (
        <div className="asbiq-buzz-zone">
          {s.lastWrong && <p className="asbiq-room-note">{byId[s.lastWrong.playerId]?.name} أخطأ — الفرصة لكم!</p>}
          {meLocked
            ? <p className="asbiq-room-note">أجبت خطأ في هذا السؤال — انتظر الباقين</p>
            : (
              <button className="asbiq-buzzer asbiq-buzzer-solo" style={pcStyle(byId[s.youId]?.color)}
                onClick={() => { navigator.vibrate?.(40); room.act('buzz'); }}>
                <span className="asbiq-buzzer-cap" />
                <span className="asbiq-buzzer-name">اسبقهم!</span>
              </button>
            )}
        </div>
      )}

      {s.phase === 'buzzed' && (
        <div className="asbiq-answer-zone pop-in" style={pcStyle(buzzer?.color)}>
          <div className="asbiq-buzzed-banner">
            <span className="asbiq-avatar">{buzzer?.name.slice(0, 1)}</span>
            {iAnswer ? <><b>أنت</b> سبقتهم! اختر الإجابة</> : <><b>{buzzer?.name}</b> ضغط الجرس…</>}
          </div>
          {iAnswer && (
            <div className="asbiq-options">
              {q.options.map((opt, i) => (
                <button key={i} className="asbiq-opt" disabled={picked !== null}
                  onClick={() => { setPicked(i); room.act('answer', { index: i }); }}>
                  <span className="asbiq-opt-key">{OPT_KEYS[i]}</span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {s.phase === 'result' && r && (
        <>
          <AsbiqVerdict
            kind={r.kind}
            title={r.kind === 'timeout' ? 'انتهى الوقت' : r.kind === 'correct' ? `${who} جاوب صح!` : `${who} أخطأ`}
            points={r.kind === 'timeout' ? null : r.points}
            answer={r.correctAnswer}
          />
          {s.isHost && <button className="asbiq-ghost asbiq-next" onClick={() => room.act('next')}>التالي ←</button>}
        </>
      )}

      <AsbiqStrip players={players} active={buzzer ? buzzer.color : null} />
    </div>
  );
}
