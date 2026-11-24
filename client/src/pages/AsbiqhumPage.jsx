import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AsbiqhumRoom from '../rooms/AsbiqhumRoom';
import { useCue } from '../sound';
import { hasSeat } from '../rooms/useRoom';
import { inviteCode } from '../rooms/roomUtils';
import { getRandomQuestions } from '../questions';
import Timer from '../components/Timer';
import './AsbiqhumPage.css';

const QUESTION_TIME = 20;
const BASE_POINTS = 100;
const WRONG_PENALTY = -20;
const QUESTIONS_PER_GAME = 10;
const MAX_PLAYERS = 8;
export const OPT_KEYS = ['أ', 'ب', 'ج', 'د'];
const PLAYER_COLORS = ['#2f62e8', '#ea6a12', '#16a34a', '#9333ea', '#dc2626', '#b7791f', '#db2777', '#0e7490'];
export const pcStyle = i => ({ '--pc': PLAYER_COLORS[(i ?? 0) % PLAYER_COLORS.length] });

// ─── Local game logic ────────────────────────────────────────────────────────

function useLocalGame() {
  const [screen, setScreen] = useState('setup'); // setup | question | buzzed | result | gameover
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [buzzedIdx, setBuzzedIdx] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [timeUpInfo, setTimeUpInfo] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const questionStartTime = useRef(null);

  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (players.find(p => p.name === name)) return;
    setPlayers(prev => [...prev, { name, score: 0 }]);
    setNameInput('');
  };

  const removePlayer = (name) => setPlayers(prev => prev.filter(p => p.name !== name));

  const startGame = () => {
    const qs = getRandomQuestions(QUESTIONS_PER_GAME);
    setQuestions(qs);
    setQIndex(0);
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
    setBuzzedIdx(null);
    setAnswerResult(null);
    setTimeUpInfo(null);
    setSelectedAnswer(null);
    questionStartTime.current = Date.now();
    setTimerRunning(true);
    setScreen('question');
  };

  const buzz = (playerIdx) => {
    if (screen !== 'question') return;
    setTimerRunning(false);
    setBuzzedIdx(playerIdx);
    setScreen('buzzed');
  };

  const submitAnswer = (answerIdx) => {
    if (screen !== 'buzzed' || buzzedIdx === null) return;
    setSelectedAnswer(answerIdx);
    const q = questions[qIndex];
    const timeElapsed = (Date.now() - questionStartTime.current) / 1000;
    const timeRemaining = Math.max(0, QUESTION_TIME - timeElapsed);
    const isCorrect = q.options[answerIdx] === q.answer;
    let points = 0;
    if (isCorrect) {
      points = Math.max(10, Math.round(BASE_POINTS * (timeRemaining / QUESTION_TIME)));
    } else {
      points = WRONG_PENALTY;
    }
    const updatedPlayers = players.map((p, i) =>
      i === buzzedIdx ? { ...p, score: Math.max(0, p.score + points) } : p
    );
    setPlayers(updatedPlayers);
    setAnswerResult({ isCorrect, pointsEarned: points, correctAnswer: q.answer, scores: updatedPlayers });
    setTimerRunning(false);
    setScreen('result');
  };

  const timeUp = () => {
    if (screen !== 'question') return;
    setTimerRunning(false);
    setTimeUpInfo({ correctAnswer: questions[qIndex]?.answer, scores: players });
    setScreen('result');
  };

  const nextQuestion = () => {
    const next = qIndex + 1;
    if (next >= questions.length) {
      setScreen('gameover');
      return;
    }
    setQIndex(next);
    setBuzzedIdx(null);
    setAnswerResult(null);
    setTimeUpInfo(null);
    setSelectedAnswer(null);
    questionStartTime.current = Date.now();
    setTimerRunning(true);
    setScreen('question');
  };

  const reset = () => {
    setScreen('setup');
    setPlayers([]);
    setQIndex(0);
    setBuzzedIdx(null);
    setAnswerResult(null);
    setTimeUpInfo(null);
    setSelectedAnswer(null);
    setTimerRunning(false);
  };

  const currentQuestion = questions[qIndex];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return {
    screen, players, nameInput, setNameInput,
    addPlayer, removePlayer, startGame,
    currentQuestion, qIndex, buzzedIdx, buzz,
    submitAnswer, answerResult, timeUpInfo, timeUp,
    selectedAnswer, timerRunning, nextQuestion,
    reset, sortedPlayers,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AsbiqhumPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => (inviteCode() || hasSeat('asbiqhum') ? 'room' : null)); // null | 'local' | 'room'

  const local = useLocalGame();
  useCue(local.screen === 'buzzed' ? `b${local.qIndex}` : null, 'buzz');
  useCue(local.screen === 'result' && local.answerResult ? `r${local.qIndex}` : null, local.answerResult?.isCorrect ? 'correct' : 'wrong');
  useCue(local.screen === 'gameover' ? 'over' : null, 'win');

  if (mode === 'room') return <AsbiqhumRoom onExit={() => setMode(null)} />;

  // ── Mode selection ──────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="asb asb-landing">
        <AsbiqTopBar onBack={() => navigate('/')} backLabel="الرئيسية" />
        <main className="asb-landing-grid">
          <section className="asb-intro pop-in">
            <span className="asb-kicker">لعبة سرعة وثقافة عامة</span>
            <h1 className="asb-display">اسبقهم</h1>
            <p className="asb-lead">
              يظهر السؤال للجميع، وأول من يضغط الجرس يجاوب. الإجابة الصحيحة تعطيك نقاطاً أكثر كل ما كنت أسرع، والخطأ يخصم منك.
            </p>
            <div className="asb-modes">
              <button className="asb-mode primary" onClick={() => setMode('local')}>
                <span className="asb-mode-title">لعب على جهاز واحد</span>
                <span className="asb-mode-sub">من ٢ إلى ٨ لاعبين، لكل لاعب زر على الشاشة</span>
                <span className="asb-mode-go">ابدأ ←</span>
              </button>
              <button className="asb-mode" onClick={() => setMode('room')}>
                <span className="asb-mode-title">غرفة أونلاين</span>
                <span className="asb-mode-sub">كل لاعب يضغط الجرس من جواله</span>
                <span className="asb-mode-go">أنشئ أو انضم ←</span>
              </button>
            </div>
            <dl className="asb-facts">
              <div><dt>{QUESTIONS_PER_GAME}</dt><dd>أسئلة في الجولة</dd></div>
              <div><dt>{QUESTION_TIME}</dt><dd>ثانية لكل سؤال</dd></div>
              <div><dt>{BASE_POINTS}</dt><dd>نقطة للأسرع</dd></div>
              <div><dt>{Math.abs(WRONG_PENALTY)}</dt><dd>نقطة خصم للخطأ</dd></div>
            </dl>
          </section>

          <aside className="asb-howto pop-in">
            <h2>كيف تلعب</h2>
            <ol className="asb-steps">
              <li><b>اقرأ السؤال</b><span>يظهر للجميع مع ٢٠ ثانية.</span></li>
              <li><b>اضغط زرك أولاً</b><span>أول من يضغط يحجز الإجابة.</span></li>
              <li><b>اختر الجواب</b><span>صح = نقاط حسب سرعتك، خطأ = −٢٠.</span></li>
            </ol>
            <div className="asb-preview" aria-hidden="true">
              <div className="asb-preview-q">ما عاصمة اليابان؟</div>
              <div className="asb-preview-btns">
                <span style={pcStyle(0)}>سارة</span>
                <span style={pcStyle(1)}>خالد</span>
                <span style={pcStyle(2)}>نورة</span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  // ── LOCAL MODE ──────────────────────────────────────────────────────────────
  if (mode === 'local') {
    if (local.screen === 'setup') {
      const full = local.players.length >= MAX_PLAYERS;
      const n = local.players.length;
      return (
        <div className="asb">
          <AsbiqTopBar onBack={() => setMode(null)} />
          <main className="asb-setup-grid">
            <section className="asb-card pop-in">
              <div className="asb-card-head">
                <h2>من يلعب؟</h2>
                <span className="asb-count">{n} / {MAX_PLAYERS}</span>
              </div>
              <form className="asb-add-row" onSubmit={e => { e.preventDefault(); if (!full) local.addPlayer(); }}>
                <input
                  className="input-field"
                  placeholder={full ? 'اكتمل العدد' : 'اكتب اسم اللاعب'}
                  value={local.nameInput}
                  onChange={e => local.setNameInput(e.target.value)}
                  maxLength={20}
                  disabled={full}
                  autoFocus
                />
                <button type="submit" className="asb-btn" disabled={full || !local.nameInput.trim()}>إضافة</button>
              </form>
              <div className="asb-roster">
                {n === 0 && <p className="asb-empty">لا يوجد لاعبون بعد — أضف لاعبَين على الأقل.</p>}
                {local.players.map((p, i) => (
                  <div key={p.name} className="asb-player pop-in" style={pcStyle(i)}>
                    <span className="asb-avatar">{p.name.slice(0, 1)}</span>
                    <span className="asb-player-name">{p.name}</span>
                    <button className="asb-x" onClick={() => local.removePlayer(p.name)} aria-label={`حذف ${p.name}`}>✕</button>
                  </div>
                ))}
              </div>
            </section>

            <aside className="asb-card asb-summary pop-in">
              <h2>الجولة</h2>
              <ul className="asb-summary-list">
                <li><span>عدد الأسئلة</span><b>{QUESTIONS_PER_GAME}</b></li>
                <li><span>وقت كل سؤال</span><b>{QUESTION_TIME} ثانية</b></li>
                <li><span>الإجابة الصحيحة</span><b>حتى {BASE_POINTS} نقطة</b></li>
                <li><span>الإجابة الخاطئة</span><b>خصم {Math.abs(WRONG_PENALTY)} نقطة</b></li>
              </ul>
              <button className="asb-btn big" onClick={local.startGame} disabled={n < 2}>
                {n < 2 ? `أضف ${2 - n === 2 ? 'لاعبَين' : 'لاعباً آخر'}` : `ابدأ (${n} لاعبين)`}
              </button>
            </aside>
          </main>
        </div>
      );
    }

    if (local.screen === 'question' || local.screen === 'buzzed') {
      const q = local.currentQuestion;
      const buzzer = local.buzzedIdx;
      return (
        <div className="asb asb-play">
          <AsbiqHud index={local.qIndex} total={QUESTIONS_PER_GAME} category={q?.category}>
            <Timer duration={QUESTION_TIME} running={local.timerRunning} onEnd={local.timeUp} />
          </AsbiqHud>

          <div className="asbiq-qcard pop-in" key={local.qIndex}>
            <p className="question-text">{q?.text}</p>
          </div>

          {local.screen === 'question' && (
            <div className="asbiq-buzz-zone">
              <p className="asbiq-buzz-hint">تعرف الجواب؟ اضغط زرك قبل الكل</p>
              <div className={`asbiq-buzz-grid n${local.players.length}`}>
                {local.players.map((p, i) => (
                  <button key={p.name} className="asbiq-buzzer" style={pcStyle(i)} onClick={() => local.buzz(i)}>
                    <span className="asbiq-buzzer-cap" />
                    <span className="asbiq-buzzer-name">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {local.screen === 'buzzed' && (
            <div className="asbiq-answer-zone pop-in" style={pcStyle(buzzer)}>
              <div className="asbiq-buzzed-banner">
                <span className="asbiq-avatar">{local.players[buzzer]?.name.slice(0, 1)}</span>
                <b>{local.players[buzzer]?.name}</b> سبقهم! اختر الإجابة
              </div>
              <div className="asbiq-options">
                {q?.options?.map((opt, i) => (
                  <button key={i} className="asbiq-opt" onClick={() => local.submitAnswer(i)} disabled={local.selectedAnswer !== null}>
                    <span className="asbiq-opt-key">{OPT_KEYS[i]}</span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <AsbiqStrip players={local.players} active={buzzer} />
        </div>
      );
    }

    if (local.screen === 'result') {
      const correct = local.answerResult?.isCorrect;
      const timeUp = !!local.timeUpInfo;
      const scores = (local.answerResult?.scores || local.timeUpInfo?.scores || local.players)
        .map((p, i) => ({ ...p, color: i }));
      const kind = timeUp ? 'timeout' : correct ? 'correct' : 'wrong';
      const who = local.players[local.buzzedIdx]?.name;
      return (
        <div className="asb asb-play asb-result">
          <AsbiqVerdict
            kind={kind}
            title={timeUp ? 'انتهى الوقت' : correct ? `صح يا ${who}!` : `خطأ يا ${who}`}
            points={timeUp ? null : local.answerResult?.pointsEarned}
            answer={local.answerResult?.correctAnswer || local.timeUpInfo?.correctAnswer}
          />
          <AsbiqRanking players={scores} />
          <button className="asbiq-go" onClick={local.nextQuestion}>
            {local.qIndex + 1 >= QUESTIONS_PER_GAME ? 'النتائج النهائية' : 'السؤال التالي'}
          </button>
        </div>
      );
    }

    if (local.screen === 'gameover') {
      const ranked = local.players.map((p, i) => ({ ...p, color: i }));
      return (
        <div className="asb asb-play asb-over">
          <AsbiqPodium players={ranked} />
          <div className="asbiq-actions">
            <button className="asbiq-ghost" onClick={local.reset}>لعبة جديدة</button>
            <button className="asbiq-go" onClick={() => navigate('/')}>الرئيسية</button>
          </div>
        </div>
      );
    }
  }

  return null;
}

// ─── Presentational pieces ───────────────────────────────────────────────────

export function AsbiqLogo({ small }) {
  return (
    <div className={`asbiq-logo ${small ? 'small' : ''}`}>
      <span className="asbiq-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 32"><path d="M14 0 2 18h8l-2 14L22 12h-8l2-12z" /></svg>
      </span>
      <span className="asbiq-title">اسبقهم</span>
    </div>
  );
}

export function AsbiqTopBar({ onBack, backLabel = 'رجوع', children }) {
  return (
    <header className="asb-top">
      <button className="asb-back" onClick={onBack}>→ {backLabel}</button>
      <AsbiqLogo small />
      <div className="asb-top-end">{children}</div>
    </header>
  );
}

export function AsbiqHud({ index, total, category, children }) {
  return (
    <div className="asbiq-hud">
      <div className="asbiq-hud-meta">
        <span className="asbiq-hud-count">سؤال <b>{index + 1}</b> من {total}</span>
        <div className="asbiq-progress">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
          ))}
        </div>
        {category && <span className="asbiq-hud-cat">{category}</span>}
      </div>
      <div className="asbiq-hud-timer">{children}</div>
    </div>
  );
}

export function AsbiqStrip({ players, active }) {
  return (
    <div className="asbiq-strip">
      {players.map((p, i) => (
        <div key={p.name} className={`asbiq-strip-item ${active === i ? 'on' : ''}`} style={pcStyle(i)}>
          <span className="asbiq-avatar">{p.name.slice(0, 1)}</span>
          <span className="asbiq-strip-name">{p.name}</span>
          <b>{p.score}</b>
        </div>
      ))}
    </div>
  );
}

export function AsbiqVerdict({ kind, title, points, answer }) {
  return (
    <div className={`asbiq-verdict ${kind} pop-in`}>
      <div className="asbiq-verdict-icon">{kind === 'correct' ? '✓' : kind === 'wrong' ? '✕' : '⏱'}</div>
      <h2>{title}</h2>
      {points != null && <span className="asbiq-verdict-pts" dir="ltr">{points > 0 ? `+${points}` : points}</span>}
      <div className="asbiq-verdict-answer"><span>الإجابة الصحيحة</span><strong>{answer}</strong></div>
    </div>
  );
}

export function AsbiqRanking({ players, offset = 0 }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const max = Math.max(1, ...sorted.map(p => p.score));
  return (
    <div className="asbiq-ranking">
      {sorted.map((p, i) => (
        <div key={p.name} className="asbiq-rank-row" style={pcStyle(p.color)}>
          <span className="asbiq-rank-pos">{i + 1 + offset}</span>
          <span className="asbiq-rank-name">{p.name}</span>
          <span className="asbiq-rank-bar"><i style={{ width: `${(p.score / max) * 100}%` }} /></span>
          <b>{p.score}</b>
        </div>
      ))}
    </div>
  );
}

export function AsbiqPodium({ players }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = [sorted[1], sorted[0], sorted[2]];
  const tie = sorted[1] && sorted[1].score === sorted[0].score;
  return (
    <div className="asbiq-finale pop-in">
      <span className="asbiq-kicker">النتيجة النهائية</span>
      <h1 className="asbiq-finale-title">{tie ? 'تعادل على الصدارة!' : `${sorted[0]?.name} سبقهم!`}</h1>
      <div className="asbiq-podium">
        {top.map((p, k) => p && (
          <div key={p.name} className={`asbiq-step step-${[2, 1, 3][k]}`} style={pcStyle(p.color)}>
            <span className="asbiq-avatar big">{p.name.slice(0, 1)}</span>
            <span className="asbiq-step-name">{p.name}</span>
            <span className="asbiq-step-score">{p.score}</span>
            <div className="asbiq-step-block">{[2, 1, 3][k]}</div>
          </div>
        ))}
      </div>
      {sorted.length > 3 && <AsbiqRanking players={sorted.slice(3)} offset={3} />}
    </div>
  );
}
