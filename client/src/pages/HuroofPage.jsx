import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  arabicLetters, shuffle, pickFresh, markSeen,
  getQuestionsByLetter, getRandomQuestion,
} from '../questions';
import Timer from '../components/Timer';
import HUROOF_THEMES, {
  getSavedTheme, saveTheme, buildCustomTheme, applyThemeCSS,
} from '../data/huroof-themes';
import HuroofRoom from '../rooms/HuroofRoom';
import { useCue } from '../sound';
import { hasSeat } from '../rooms/useRoom';
import { inviteCode } from '../rooms/roomUtils';
import './HuroofPage.css';

// ── Constants ──────────────────────────────────────────────────────────────────
const BUZZER_TIME = 12;
const ANSWER_TIME = 30;
const STEAL_TIME  = 15;
const PRE_Q_MS    = 1600;
const RESULT_MS   = 2200;

// ── Hex grid: 5 rows × 5 cols = 25 hexes ──────────────────────────────────────
// Visual arrangement (odd rows shifted right by W/2, grid rendered LTR):
//  Row 0 (even): [0]  [1]  [2]  [3]  [4]
//  Row 1 (odd) :   [5]  [6]  [7]  [8]  [9]
//  Row 2 (even): [10] [11] [12] [13] [14]   ← center = 12
//  Row 3 (odd) :   [15] [16] [17] [18] [19]
//  Row 4 (even): [20] [21] [22] [23] [24]
const N           = 5;
const HEX_ROWS    = [5, 5, 5, 5, 5];
const TOTAL_HEXES = N * N;
const CENTER_IDX  = 12;

const DEFAULT_COLORS = ['#22c55e','#f97316','#3b82f6','#a855f7','#ef4444','#eab308'];
const DEFAULT_NAMES  = [
  'الفريق الأخضر','الفريق البرتقالي','الفريق الأزرق',
  'الفريق البنفسجي','الفريق الأحمر','الفريق الذهبي',
];

// Path goals (2-team "path" mode — the classic حروف rule):
//  team 0 connects the left edge to the right edge  (↔)
//  team 1 connects the top edge to the bottom edge  (↕)
export const PATH_GOAL = ['↔ يربط اليمين باليسار', '↕ يربط الأعلى بالأسفل'];

// ── Helpers ────────────────────────────────────────────────────────────────────
export function rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/** 25 distinct letters, preferring letters with the most questions available. */
function buildGrid() {
  const ranked = arabicLetters
    .map(l => ({ l, n: getQuestionsByLetter(l).length }))
    .filter(x => x.n > 0);
  const letters = shuffle(ranked.map(x => x.l)).slice(0, TOTAL_HEXES);
  return Array.from({ length: TOTAL_HEXES }, (_, i) => ({
    index: i,
    letter: letters[i % letters.length],
    owner: null, // null | teamIndex
  }));
}

function neighbours(idx) {
  const r = Math.floor(idx / N), c = idx % N;
  const odd = r % 2 === 1;
  const cand = [
    [r, c - 1], [r, c + 1],
    [r - 1, odd ? c : c - 1], [r - 1, odd ? c + 1 : c],
    [r + 1, odd ? c : c - 1], [r + 1, odd ? c + 1 : c],
  ];
  return cand
    .filter(([rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N)
    .map(([rr, cc]) => rr * N + cc);
}

/** Returns the winning path (array of indices) for `team`, or null. */
function findPath(grid, team) {
  const horizontal = team === 0;
  const isStart = i => horizontal ? i % N === 0       : i < N;
  const isEnd   = i => horizontal ? i % N === N - 1   : i >= N * (N - 1);
  const prev = new Map();
  const queue = [];
  grid.forEach(h => { if (h.owner === team && isStart(h.index)) { prev.set(h.index, -1); queue.push(h.index); } });
  while (queue.length) {
    const cur = queue.shift();
    if (isEnd(cur)) {
      const path = [];
      for (let p = cur; p !== -1; p = prev.get(p)) path.push(p);
      return path;
    }
    for (const nb of neighbours(cur)) {
      if (!prev.has(nb) && grid[nb].owner === team) { prev.set(nb, cur); queue.push(nb); }
    }
  }
  return null;
}

function drawQuestion(letter, usedIds) {
  const pool = getQuestionsByLetter(letter);
  const q = pickFresh(pool, 1, usedIds)[0] || pickFresh(pool, 1)[0] || getRandomQuestion();
  if (q) { usedIds.add(q.id); markSeen([q.id]); }
  return q;
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onOnline, navigate }) {
  const [numTeams,   setNumTeams]   = useState(2);
  const [names,      setNames]      = useState([...DEFAULT_NAMES]);
  const [colors,     setColors]     = useState([...DEFAULT_COLORS]);
  const [winMode,    setWinMode]    = useState('path'); // path | majority
  const [themeId,    setThemeId]    = useState(() => getSavedTheme()?.id || 'classic');
  const [customA,    setCustomA]    = useState('#22c55e');
  const [customB,    setCustomB]    = useState('#f97316');

  useEffect(() => {
    const t = themeId === 'custom' ? buildCustomTheme(customA, customB) : HUROOF_THEMES[themeId];
    if (t) applyThemeCSS(t);
  }, [themeId, customA, customB]);

  const pathMode = numTeams === 2 && winMode === 'path';

  const start = () => {
    const teams = Array.from({ length: numTeams }, (_, i) => ({
      name: names[i] || DEFAULT_NAMES[i],
      color: colors[i] || DEFAULT_COLORS[i],
    }));
    onStart({ teams, pathMode });
  };

  return (
    <div className="page huroof-setup">
      <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
      <div className="setup-card card pop-in">
        <div className="setup-icon">⬡</div>
        <h1>لعبة الحروف</h1>
        <p className="setup-desc">
          كل خلية فيها حرف — السؤال إجابته تبدأ بهذا الحرف. الفريق الأسرع يضغط الجرس ويجيب، ومن يجيب صح يأخذ الخلية ويختار الحرف التالي.
        </p>

        {/* Team count */}
        <div className="grid-size-select">
          <label>عدد الفرق:</label>
          <div className="size-btns">
            {[2, 3, 4].map(n => (
              <button key={n} className={`size-btn ${numTeams === n ? 'selected' : ''}`}
                onClick={() => setNumTeams(n)}>{n} فرق
              </button>
            ))}
          </div>
        </div>

        {/* Win mode */}
        <div className="grid-size-select">
          <label>طريقة الفوز:</label>
          <div className="size-btns">
            <button className={`size-btn ${pathMode ? 'selected' : ''}`}
              disabled={numTeams !== 2}
              title={numTeams !== 2 ? 'متاح لفريقين فقط' : ''}
              onClick={() => setWinMode('path')}>🛤 توصيل مسار</button>
            <button className={`size-btn ${!pathMode ? 'selected' : ''}`}
              onClick={() => setWinMode('majority')}>🔢 أكثر خلايا</button>
          </div>
        </div>
        <p className="win-mode-hint">
          {pathMode
            ? 'أول فريق يكوّن مسارًا متصلًا بين ضلعيه يفوز فورًا.'
            : 'عند امتلاء الشبكة يفوز الفريق صاحب أكبر عدد من الخلايا.'}
        </p>

        {/* Team rows */}
        <div className="huroof-teams-config">
          {Array.from({ length: numTeams }, (_, i) => (
            <div key={i} className="huroof-team-row">
              <input type="color" value={colors[i]}
                onChange={e => { const c=[...colors]; c[i]=e.target.value; setColors(c); }}
                className="team-color-picker" />
              <input className="input-field team-name-input"
                value={names[i]}
                onChange={e => { const n=[...names]; n[i]=e.target.value; setNames(n); }}
                maxLength={20} placeholder={`الفريق ${i+1}`} />
              {pathMode && <span className="team-goal" style={{ color: colors[i] }}>{PATH_GOAL[i]}</span>}
            </div>
          ))}
        </div>

        {/* Theme presets */}
        <div className="theme-picker">
          <label>ثيم الألوان:</label>
          <div className="theme-presets">
            {Object.values(HUROOF_THEMES).map(t => (
              <button key={t.id} title={t.name}
                className={`theme-swatch ${themeId === t.id ? 'active' : ''}`}
                onClick={() => { setThemeId(t.id); saveTheme(t.id); }}>
                <span style={{ background: t.teamA.main }} />
                <span style={{ background: t.teamB.main }} />
              </button>
            ))}
            <button title="مخصص"
              className={`theme-swatch ${themeId === 'custom' ? 'active' : ''}`}
              onClick={() => setThemeId('custom')}>
              <span style={{ background: customA }} />
              <span style={{ background: customB }} />
            </button>
          </div>
          {themeId === 'custom' && (
            <div className="custom-theme-row">
              <label>اللون أ:</label>
              <input type="color" value={customA} onChange={e => setCustomA(e.target.value)} />
              <label>اللون ب:</label>
              <input type="color" value={customB} onChange={e => setCustomB(e.target.value)} />
            </div>
          )}
        </div>

        <button className="btn-green start-game-btn" onClick={start}>
          ابدأ اللعبة ⬡
        </button>
        <button className="btn-secondary huroof-online-btn" onClick={onOnline}>
          🌐 غرفة أونلاين <small>فريقان، كل لاعب يضغط الجرس من جواله</small>
        </button>
      </div>
    </div>
  );
}

// ── Hex Grid ───────────────────────────────────────────────────────────────────
export function HexGrid({ grid, teams, activeIdx, selectableIdxs, onSelect, phase, pathMode, winPath }) {
  const pathSet = new Set(winPath || []);
  const frame = pathMode ? {
    '--edge-h': teams[0]?.color, // left/right edges → team 0
    '--edge-v': teams[1]?.color, // top/bottom edges → team 1
  } : {};
  const rowStarts = HEX_ROWS.map((_, r) => HEX_ROWS.slice(0, r).reduce((a, b) => a + b, 0));
  return (
    <div className="hex-grid-container">
      <div className={`hex-grid ${pathMode ? 'hex-grid-framed' : ''}`} dir="ltr" style={frame}>
        {HEX_ROWS.map((count, rowIdx) => {
          const rowHexes = grid.slice(rowStarts[rowIdx], rowStarts[rowIdx] + count);
          const isOdd = rowIdx % 2 === 1;
          return (
            <div key={rowIdx} className={`hex-row ${isOdd ? 'hex-row-odd' : ''}`}>
              {rowHexes.map(hex => {
                const isOwned   = hex.owner !== null;
                const isActive  = hex.index === activeIdx;
                const isCenter  = hex.index === CENTER_IDX && !isOwned && phase !== 'path-select';
                const isSelect  = selectableIdxs.includes(hex.index);
                const canClick  = phase === 'path-select' && isSelect && !isOwned;
                const ownerTeam = isOwned ? teams[hex.owner] : null;

                return (
                  <button
                    key={hex.index}
                    className={[
                      'hex-cell',
                      isOwned   ? 'hex-owned'     : '',
                      isActive  ? 'selected-cell' : '',
                      isCenter  ? 'center-hex'    : '',
                      isSelect && !isOwned ? 'adjacent-selectable' : '',
                      canClick  ? 'clickable'     : '',
                      pathSet.has(hex.index) ? 'hex-win-path' : '',
                    ].filter(Boolean).join(' ')}
                    style={ownerTeam ? {
                      '--cell-color':     ownerTeam.color,
                      '--cell-color-dim': rgba(ownerTeam.color, 0.18),
                    } : {}}
                    onClick={() => canClick && onSelect(hex.index)}
                    disabled={!canClick}
                  >
                    <div className="hex-cell-inner">{hex.letter}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score Bar ──────────────────────────────────────────────────────────────────
export function ScoreBar({ teams, counts, controlIdx, pathMode }) {
  return (
    <div className="score-bar">
      {teams.map((t, i) => (
        <div key={i} className={`score-item ${controlIdx === i ? 'score-active' : ''}`}
          style={{
            '--sc':       t.color,
            '--sc-dim':   rgba(t.color, 0.14),
            '--sc-border':rgba(t.color, 0.35),
            '--sc-glow':  rgba(t.color, 0.4),
          }}>
          <span className="score-dot" style={{ background: t.color }} />
          {t.name}
          {pathMode && <small className="score-goal">{PATH_GOAL[i].split(' ')[0]}</small>}
          <strong className="score-pts">{counts[i]}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Buzzer Overlay ─────────────────────────────────────────────────────────────
function BuzzerOverlay({ teams, letter, question, onBuzz, timerRun, onTimeout, onSkip }) {
  return (
    <div className="buzzer-overlay">
      <div className="buzzer-card">
        <div className="letter-badge" style={{ background: 'var(--huroof-accent)' }}>{letter}</div>
        <div className="buzzer-badge">⚡ اضغط الجرس أولاً!</div>
        {question?.category && <div className="q-category">{question.category}</div>}
        <p className="q-text">{question?.text}</p>
        <Timer duration={BUZZER_TIME} running={timerRun} onEnd={onTimeout} key={question?.id ?? 'bz'} />
        <div className="buzzer-team-grid">
          {teams.map((t, i) => (
            <button key={i}
              className="buzzer-btn"
              style={{ '--bt': t.color, '--bt-dim': rgba(t.color, 0.2), '--bt-glow': rgba(t.color, 0.45) }}
              onClick={() => onBuzz(i)}>
              {t.name}
            </button>
          ))}
        </div>
        <button className="skip-q-btn" onClick={onSkip}>🔄 سؤال آخر لنفس الحرف</button>
      </div>
    </div>
  );
}

// ── Answer Overlay ─────────────────────────────────────────────────────────────
function AnswerOverlay({ question, letter, team, isSteal, selAns, onAnswer, timerRun, onTimeout, timerKey }) {
  const revealed = selAns !== null;
  return (
    <div className="buzzer-overlay">
      <div className="buzzer-card">
        {isSteal && <div className="steal-pill">⚡ فرصة السرقة</div>}
        <div className="buzzer-badge" style={{ color: team?.color }}>{team?.name}</div>
        <div className="letter-badge" style={{ background: team?.color || 'var(--huroof-accent)' }}>
          {letter}
        </div>
        <div className="q-hint">الإجابة تبدأ بحرف «{letter}»</div>
        <p className="q-text">{question?.text}</p>
        <Timer
          duration={isSteal ? STEAL_TIME : ANSWER_TIME}
          running={timerRun}
          onEnd={onTimeout}
          key={timerKey}
        />
        <div className="opts-grid">
          {question?.options?.map((opt, i) => {
            const isRight = opt === question.answer;
            const cls = !revealed ? '' : isRight ? 'opt-correct' : selAns === i ? 'opt-wrong' : 'opt-dim';
            return (
              <button key={i}
                className={`opt-btn ${cls}`}
                onClick={() => !revealed && onAnswer(i)}
                disabled={revealed}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Result Flash ───────────────────────────────────────────────────────────────
function ResultFlash({ result }) {
  if (!result) return null;
  const cls = result.correct ? 'flash-correct' : 'flash-wrong';
  let text;
  if (result.correct)      text = `✅ ${result.teamName} — إجابة صحيحة!`;
  else if (result.noBuzz)  text = `⏱ لم يضغط أحد — الإجابة: ${result.answer}`;
  else if (result.timeout) text = `⏰ انتهى الوقت — الصواب: ${result.answer}`;
  else                     text = `❌ خطأ — الصواب: ${result.answer}`;
  return <div className={`result-flash ${cls} pop-in`}>{text}</div>;
}

// ── Game Hook ──────────────────────────────────────────────────────────────────
// phase: 'pre' | 'buzzing' | 'answering' | 'result' | 'path-select' | 'over'
function useGame(teams, pathMode) {
  const [grid,       setGrid]       = useState(() => buildGrid());
  const [phase,      setPhase]      = useState('pre');
  const [activeIdx,  setActiveIdx]  = useState(CENTER_IDX);
  const [controlIdx, setControlIdx] = useState(null);
  const [answering,  setAnswering]  = useState(null);  // team currently answering
  const [isSteal,    setIsSteal]    = useState(false);
  const [question,   setQuestion]   = useState(null);
  const [selAns,     setSelAns]     = useState(null);
  const [result,     setResult]     = useState(null);
  const [timerRun,   setTimerRun]   = useState(false);
  const [selectable, setSelectable] = useState([CENTER_IDX]);
  const [winInfo,    setWinInfo]    = useState(null);  // { team, path } | { team, majority, tie }
  const [attempt,    setAttempt]    = useState(0);      // bumps the timer key

  const gridRef   = useRef(grid);
  const queueRef  = useRef([]);   // teams still allowed to try this hex
  const usedIds   = useRef(new Set());
  const timer     = useRef(null);
  const busy      = useRef(false); // guards double clicks / timer races

  const later = (fn, ms) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const commitGrid = (g) => { gridRef.current = g; setGrid(g); };

  const openQuestion = useCallback((idx) => {
    const q = drawQuestion(gridRef.current[idx].letter, usedIds.current);
    busy.current = false;
    setActiveIdx(idx);
    setQuestion(q);
    setSelAns(null);
    setResult(null);
    setAnswering(null);
    setIsSteal(false);
    queueRef.current = [];
    setPhase('buzzing');
    setTimerRun(true);
    setAttempt(a => a + 1);
  }, []);

  // First question on the centre hex
  useEffect(() => {
    later(() => openQuestion(CENTER_IDX), PRE_Q_MS);
  }, []); // eslint-disable-line

  const finishMajority = (g) => {
    const counts = teams.map((_, i) => g.filter(h => h.owner === i).length);
    const max = Math.max(...counts);
    const leaders = counts.map((c, i) => c === max ? i : -1).filter(i => i >= 0);
    setWinInfo({ team: leaders[0], tie: leaders.length > 1, leaders, majority: true });
    setPhase('over');
  };

  const goToSelect = (g, ctrl) => {
    setResult(null);
    setSelAns(null);
    setActiveIdx(-1);
    if (!g.some(h => h.owner === null)) { finishMajority(g); return; }
    setControlIdx(ctrl);
    setSelectable(g.filter(h => h.owner === null).map(h => h.index));
    setPhase('path-select');
  };

  const buzz = useCallback((tIdx) => {
    if (busy.current) return;
    setAnswering(tIdx);
    setIsSteal(false);
    queueRef.current = teams.map((_, i) => i).filter(i => i !== tIdx);
    setPhase('answering');
    setTimerRun(true);
    setAttempt(a => a + 1);
  }, [teams]);

  const skipQuestion = useCallback(() => {
    if (busy.current) return;
    setTimerRun(false);
    openQuestion(activeIdx);
  }, [activeIdx, openQuestion]);

  const unresolved = (res) => {
    setTimerRun(false);
    setResult(res);
    setPhase('result');
    // The hex stays free — it can be picked again later with a new question.
    later(() => goToSelect(gridRef.current, controlIdx), RESULT_MS);
  };

  const noBuzzImpl = () => {
    if (busy.current) return;
    busy.current = true;
    unresolved({ noBuzz: true, answer: question?.answer });
  };

  const resolve = (correct, timeout, aIdx) => {
    if (busy.current) return;
    busy.current = true;
    setTimerRun(false);
    setSelAns(aIdx ?? -1);

    if (correct) {
      const winner = answering;
      const g = gridRef.current.map(h => h.index === activeIdx ? { ...h, owner: winner } : h);
      commitGrid(g);
      setResult({ correct: true, teamName: teams[winner]?.name, answer: question?.answer });
      setPhase('result');
      const path = pathMode ? findPath(g, winner) : null;
      later(() => {
        if (path) { setWinInfo({ team: winner, path }); setPhase('over'); return; }
        goToSelect(g, winner);
      }, RESULT_MS);
      return;
    }

    const res = { correct: false, timeout, answer: question?.answer };
    const queue = queueRef.current;
    if (queue.length > 0) {
      setResult(res);
      setPhase('result');
      later(() => {
        const next = queue[0];
        queueRef.current = queue.slice(1);
        busy.current = false;
        setResult(null);
        setSelAns(null);
        setAnswering(next);
        setIsSteal(true);
        setPhase('answering');
        setTimerRun(true);
        setAttempt(a => a + 1);
      }, 1800);
    } else {
      unresolved(res);
    }
  };

  // Stable callbacks (Timer restarts its interval whenever onEnd changes)
  const latest = useRef({});
  useEffect(() => { latest.current = { resolve, noBuzzImpl, question }; });
  const answer = useCallback((aIdx) => {
    const { resolve: r, question: q } = latest.current;
    r(q?.options?.[aIdx] === q?.answer, false, aIdx);
  }, []);
  const answerTimeout = useCallback(() => latest.current.resolve(false, true, null), []);
  const noBuzz        = useCallback(() => latest.current.noBuzzImpl(), []);

  const selectHex = useCallback((idx) => {
    setSelectable([]);
    setActiveIdx(idx);
    setPhase('pre');
    later(() => openQuestion(idx), PRE_Q_MS);
  }, [openQuestion]);

  const counts = teams.map((_, i) => grid.filter(h => h.owner === i).length);

  return {
    grid, phase, activeIdx, controlIdx, answering, isSteal, attempt,
    question, selAns, result, timerRun, selectable, winInfo, counts,
    buzz, noBuzz, answer, answerTimeout, selectHex, skipQuestion,
  };
}

// ── Game Over Screen ───────────────────────────────────────────────────────────
function GameOver({ teams, grid, counts, winInfo, pathMode, onBack, onHome }) {
  const winner = teams[winInfo?.team];
  const title = winInfo?.tie
    ? `تعادل: ${winInfo.leaders.map(i => teams[i].name).join(' و ')}!`
    : winInfo?.path
      ? `فاز ${winner?.name} بتوصيل المسار!`
      : `فاز ${winner?.name}!`;
  return (
    <div className="page asbiq-gameover huroof-over">
      <div className="gameover-hero pop-in">
        <div className="gameover-trophy">🏆</div>
        <h1 className="winner-text" style={{ color: winInfo?.tie ? 'var(--gold)' : winner?.color }}>{title}</h1>
      </div>
      <div className="final-grid-wrap">
        <HexGrid
          grid={grid} teams={teams}
          activeIdx={-1} selectableIdxs={[]}
          onSelect={() => {}} phase="over"
          pathMode={pathMode} winPath={winInfo?.path}
        />
      </div>
      <div className="score-bar" style={{ marginTop: 14 }}>
        {teams.map((t, i) => (
          <div key={i} className="score-item"
            style={{ '--sc': t.color, '--sc-dim': rgba(t.color,0.15), '--sc-border': rgba(t.color,0.35) }}>
            <span className="score-dot" style={{ background: t.color }} />
            {t.name} — <strong>{counts[i]} خلية</strong>
          </div>
        ))}
      </div>
      <div className="gameover-actions">
        <button className="btn-green" onClick={onBack}>العب مجدداً</button>
        <button className="btn-secondary" onClick={onHome}>الرئيسية</button>
      </div>
    </div>
  );
}

// ── Game Screen ────────────────────────────────────────────────────────────────
function GameScreen({ teams, pathMode, onBack, onHome }) {
  const g = useGame(teams, pathMode);
  useCue(g.phase === 'answering' && !g.isSteal ? `a${g.attempt}` : null, 'buzz');
  useCue(g.result && !g.result.noBuzz && !g.result.timeout ? `r${g.attempt}` : null, g.result?.correct ? 'correct' : 'wrong');
  useCue(g.phase === 'over' ? 'over' : null, 'win');

  if (g.phase === 'over') {
    return <GameOver teams={teams} grid={g.grid} counts={g.counts} winInfo={g.winInfo}
      pathMode={pathMode} onBack={onBack} onHome={onHome} />;
  }

  const ctrlTeam    = g.controlIdx !== null ? teams[g.controlIdx] : null;
  const answerTeam  = g.answering !== null ? teams[g.answering] : null;
  const letter      = g.grid[g.activeIdx]?.letter;

  const phaseLabel = {
    pre:           `🔍 استعدوا... حرف «${letter ?? ''}»`,
    buzzing:       '⚡ اضغط الجرس!',
    answering:     answerTeam ? (g.isSteal ? `⚡ سرقة — ${answerTeam.name}` : `🎯 ${answerTeam.name} يجيب`) : '',
    result:        '📋 النتيجة',
    'path-select': ctrlTeam ? `🗺 ${ctrlTeam.name} — اختر الحرف التالي` : '🗺 اختاروا الحرف التالي',
  }[g.phase] || '';

  return (
    <div className="huroof-game-page">
      <div className="huroof-header">
        <button className="back-btn-inline" onClick={onBack}>← العودة</button>
        <div className="huroof-phase-label">{phaseLabel}</div>
      </div>

      <ScoreBar teams={teams} counts={g.counts} controlIdx={g.controlIdx} pathMode={pathMode} />

      {g.phase === 'path-select' && (
        <div className="path-select-hint" style={ctrlTeam ? {
          borderColor: rgba(ctrlTeam.color, 0.5),
          color: ctrlTeam.color,
          background: rgba(ctrlTeam.color, 0.08),
        } : {}}>
          🗺 {ctrlTeam ? ctrlTeam.name : 'أي فريق'} — اضغط على أي حرف لم يُؤخذ بعد
        </div>
      )}

      {g.result && <ResultFlash result={g.result} />}

      <HexGrid
        grid={g.grid}
        teams={teams}
        activeIdx={g.activeIdx}
        selectableIdxs={g.selectable}
        onSelect={g.selectHex}
        phase={g.phase}
        pathMode={pathMode}
      />

      <div className="teams-legend">
        {teams.map((t, i) => (
          <div key={i} className="legend-item"
            style={{ color: t.color, borderColor: rgba(t.color, 0.4), background: rgba(t.color, 0.07) }}>
            <span className="score-dot" style={{ background: t.color }} />
            {t.name}: {g.counts[i]} خلية {pathMode && `· ${PATH_GOAL[i]}`}
          </div>
        ))}
      </div>

      {g.phase === 'buzzing' && (
        <BuzzerOverlay
          teams={teams}
          letter={letter}
          question={g.question}
          onBuzz={g.buzz}
          timerRun={g.timerRun}
          onTimeout={g.noBuzz}
          onSkip={g.skipQuestion}
        />
      )}

      {(g.phase === 'answering' || (g.phase === 'result' && g.selAns !== null)) && answerTeam && (
        <AnswerOverlay
          question={g.question}
          letter={letter}
          team={answerTeam}
          isSteal={g.isSteal}
          selAns={g.selAns}
          onAnswer={g.answer}
          timerRun={g.timerRun}
          onTimeout={g.answerTimeout}
          timerKey={`t${g.attempt}`}
        />
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function HuroofPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null); // { teams, pathMode }
  const [gameKey, setGameKey] = useState(0);
  const [online, setOnline] = useState(() => !!(inviteCode() || hasSeat('huroof')));

  useEffect(() => { applyThemeCSS(getSavedTheme()); }, []);

  if (online) return <HuroofRoom onExit={() => setOnline(false)} />;
  if (!config) {
    return <SetupScreen onStart={(c) => { setConfig(c); setGameKey(k => k + 1); }} onOnline={() => setOnline(true)} navigate={navigate} />;
  }
  return (
    <GameScreen
      key={gameKey}
      teams={config.teams}
      pathMode={config.pathMode}
      onBack={() => setConfig(null)}
      onHome={() => navigate('/')}
    />
  );
}
